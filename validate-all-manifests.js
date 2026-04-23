const fs = require('fs').promises;
const path = require('path');
const readFile = fs.readFile;

const request = require('request');
const crypto = require('crypto');

const Ajv = require('ajv');
const ajv = new Ajv();
const addFormats = require('ajv-formats');
addFormats(ajv);

const schema = require('./manifest.schema.json');
const validate = ajv.compile(schema);
const manifestsRoot = path.join(__dirname, 'manifests');
const deleteInvalid = process.argv.includes('--delete') || process.argv.includes('--delete-invalid');

async function validateAll() {

    let hasErrors = false;
    let hasDeleteErrors = false;
    let deletedFiles = 0;
    const invalidFiles = [];
    const files = await getAllJsonFiles(manifestsRoot);

    for(const file of files) {
        const fullPath = file;
        try {
            console.log('\x1b[0m', 'Found manifest in ' + fullPath);
            const data = await readFile(fullPath);
            const json = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
            const valid = validate(json);
            
            if(!valid) {
                throw new Error(fullPath + ' -- '  + JSON.stringify(validate.errors))
            } else {
                const remoteHash = await getHashFromRemote(json.Installer.URL, json.Installer.ChecksumType);
                if(remoteHash.toLowerCase() !== json.Installer.Checksum.toLowerCase()) {
                    throw new Error(getHashMismatchMessage(json, remoteHash));
                }                

                console.log("\x1b[32m",'Manifest valid at ' + fullPath);
            }    
        } catch(e) {
            hasErrors = true;
            invalidFiles.push({ file: fullPath, error: e.message });
            console.log('\x1b[31m', 'INVALID MANIFEST! ' + e.message);
            if(deleteInvalid) {
                try {
                    await deleteManifest(fullPath);
                    deletedFiles++;
                    console.log('\x1b[33m', 'Deleted invalid manifest at ' + fullPath);
                } catch(deleteError) {
                    hasDeleteErrors = true;
                    console.log('\x1b[31m', 'FAILED TO DELETE INVALID MANIFEST! ' + deleteError.message);
                }
            }
        }
    }

    if(invalidFiles.length > 0) {
        console.log('\x1b[31m', 'Invalid manifests found:');
        for(const invalidFile of invalidFiles) {
            console.log('\x1b[31m', ` - ${invalidFile.file}`);
        }
    }

    if(deleteInvalid && invalidFiles.length > 0) {
        console.log('\x1b[33m', `Deleted ${deletedFiles} invalid manifest(s).`);
    }

    if(hasErrors && (!deleteInvalid || hasDeleteErrors)) {
        process.exit(1);
    }
};

async function deleteManifest(file) {
    const relativePath = path.relative(manifestsRoot, file);
    if(relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Refusing to delete file outside manifests directory: ${file}`);
    }

    await fs.unlink(file);
}

function getHashFromRemote(url, hashalgorithm) {
    return new Promise((resolve, reject) => {
        const hasher = crypto.createHash(hashalgorithm.toLowerCase());
        hasher.setEncoding('hex');
        let settled = false;

        const fail = error => {
            if(!settled) {
                settled = true;
                reject(error);
            }
        };

        const remote = request(url)
            .on('response', response => {
                if(response.statusCode < 200 || response.statusCode >= 300) {
                    remote.abort();
                    fail(new Error(getHttpStatusMessage(url, response)));
                    return;
                }

                response
                    .on('error', x => fail(new Error(`Failed to read ${url}: ${x.message}`)))
                    .pipe(hasher)
                    .on('finish', () => {
                        if(!settled) {
                            settled = true;
                            resolve(hasher.read());
                        }
                    })
                    .on('error', x => fail(new Error(`Failed to hash ${url}: ${x.message}`)));
            })
            .on('error', x => fail(new Error(`Failed to get ${url}: ${x.message}`)));
    });
}

function getHttpStatusMessage(url, response) {
    const status = response.statusMessage
        ? `${response.statusCode} ${response.statusMessage}`
        : response.statusCode;

    if(response.statusCode === 404) {
        return `Installer URL returned HTTP ${status} from ${url}. The installer is probably missing, renamed, private, or points to a release asset that no longer exists.`;
    }

    return `Installer URL returned HTTP ${status} from ${url}`;
}

function getHashMismatchMessage(manifest, remoteHash) {
    const expectedHash = manifest.Installer.Checksum;
    const url = manifest.Installer.URL;

    return `Expected hash to be ${expectedHash}, but actually was ${remoteHash} from ${url}`;
}

async function getAllJsonFiles(dir) {
  let results = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await getAllJsonFiles(fullPath);
      results.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

validateAll();
