const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require('ajv-formats');
addFormats(ajv);

const root = path.join(__dirname, 'manifests');

const schema = require('./manifest.schema.json');
const validate = ajv.compile(schema);

async function scanDir(dir) {
    let manifests = [];
    let manifestsNetFramework = [];
    let manifestsNetCore = [];
    let manifestsNetCoreMeta = [];
    const report = {
        failed: 0,
        successful: 0,
        total: 0,
        invalid: 0
    };
    const files = await fs.promises.readdir(dir);
    for( const file of files ) {
        const fullPath = path.join( dir, file );
        
        if(fs.lstatSync(fullPath).isDirectory()) {
            const {manifests: jsons, manifestsNetFramework: netFrameworkJsons, manifestsNetCore: netCoreJsons, manifestsNetCoreMeta:netCoreMetaJsons, report: report2} = await scanDir(fullPath);
            report.total += report2.total;
            report.failed += report2.failed;
            report.invalid += report2.invalid;
            report.successful += report2.successful;
            manifests = [...manifests, ...jsons];
            manifestsNetFramework = [...manifestsNetFramework, ...netFrameworkJsons];
            manifestsNetCore = [...manifestsNetCore, ...netCoreJsons];
            manifestsNetCoreMeta = [...manifestsNetCoreMeta, ...netCoreMetaJsons];
        } else {
            try {
                console.log('\x1b[0m', 'Found manifest in ' + fullPath);
                const data = await readFile(fullPath);
                const json = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
                const valid = validate(json);
                report.total++;
                if(!valid) {
                    report.failed++;
                    console.log('\x1b[31m','INVALID MANIFEST! ' + fullPath);
                    console.log('\x1b[31m',JSON.stringify(validate.errors));
                } else {
                    report.successful++;
                    console.log("\x1b[32m",'Manifest valid at ' + fullPath);
                    manifests.push(json);
                    if(parseInt(json.MinimumApplicationVersion.Major) < 3) {
                        manifestsNetFramework.push(json);
                    } else {
                        manifestsNetCore.push(json);
                        const { Descriptions, ChangelogURL, License, LicenseURL, Repository, Homepage, ...meta } = json;
                        manifestsNetCoreMeta.push(meta);
                    }
                }    
            } catch(e) {
                console.log('\x1b[31m', 'INVALID MANIFEST! ' + e.message);
                report.invalid++;
            }        
        }        
    }
    return {manifests, manifestsNetCore, manifestsNetCoreMeta, manifestsNetFramework, report};
}

function validateIds(manifests) {
    const ids = {};
    let idcollision = false;
    for(let manifest of manifests) {
        var manifestName = normalizeName(manifest.Name);
        if(ids[manifest.Identifier]) {            
            if(manifestName !== ids[manifest.Identifier]) {
                console.log('\x1b[31m',`Id collision for manifest! ${manifestName} and ${ids[manifest.Identifier]}`);
                idcollision = true;
            }
        }
        ids[manifest.Identifier] = manifestName;
    }
    return idcollision;
}

function normalizeName(name) {
    return name.replace(/\s+/g, '').toLowerCase();
}

(async ()=>{
    console.log('Scanning for manifests in ' + root);
    const {manifests, manifestsNetCore, manifestsNetCoreMeta, manifestsNetFramework, report} = await scanDir(root);
    const idcollision = validateIds(manifests);

    const releaseManifests = manifests.filter(x => x.Channel === 'Release' || !x.hasOwnProperty('Channel')).map(({Channel, ...rest}) => rest);

    // Release Channel Plugins
    const targetDir = __dirname + '/Plugins';
    if (!fs.existsSync(targetDir)){
        fs.mkdirSync(targetDir);
    }
    await writeFile(targetDir + '/manifests.json', JSON.stringify(releaseManifests), function(err, result) {
        if(err) console.log('\x1b[31m','error', err);
    });
    // await writeFile(targetDir + '/manifestsNetCore.json', JSON.stringify(manifestsNetCore), function(err, result) {
    //     if(err) console.log('\x1b[31m','error', err);
    // });
    // await writeFile(targetDir + '/manifestsNetCoreMeta.json', JSON.stringify(manifestsNetCoreMeta), function(err, result) {
    //     if(err) console.log('\x1b[31m','error', err);
    // });
    // await writeFile(targetDir + '/manifestsNetFramework.json', JSON.stringify(manifestsNetFramework), function(err, result) {
    //     if(err) console.log('\x1b[31m','error', err);
    // });

    // Beta Channel Plugins
    const betaManifests = manifests.filter(x => x.Channel === 'Beta').map(({Channel, ...rest}) => rest);

    const betaTargetDir = __dirname + '/Plugins/Beta';
    if (!fs.existsSync(betaTargetDir)){
        fs.mkdirSync(betaTargetDir);
    }
    await writeFile(betaTargetDir + '/manifests.json', JSON.stringify(betaManifests), function(err, result) {
        if(err) console.log('\x1b[31m','error', err);
    });

    console.log('\x1b[0m',`done - total: ${report.total} total, ${report.successful} successful, ${report.failed} failed, ${report.invalid} invalid`);
    if(report.failed > 0 || report.invalid > 0 || idcollision) {
        process.exit(1);
    }
})();


