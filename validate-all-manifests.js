const fsSync = require('fs');
const fs = fsSync.promises;
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
const downloadDirectory = getArgumentValue(['--download-dir', '--store-downloads']);
const downloadRoot = downloadDirectory ? path.resolve(process.cwd(), downloadDirectory) : null;

async function validateAll() {

    let hasErrors = false;
    let hasDeleteErrors = false;
    let deletedFiles = 0;
    const invalidFiles = [];
    const files = await getAllJsonFiles(manifestsRoot);

    if(downloadRoot) {
        await fs.mkdir(downloadRoot, { recursive: true });
        console.log('\x1b[0m', 'Storing downloaded installers in ' + downloadRoot);
    }

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
                const downloadTarget = getDownloadTarget(fullPath, json);
                if(downloadTarget) {
                    await fs.mkdir(path.dirname(downloadTarget), { recursive: true });
                }

                const remoteHash = await getHashFromRemote(json.Installer.URL, json.Installer.ChecksumType, downloadTarget);
                if(downloadTarget) {
                    await fs.copyFile(fullPath, path.join(path.dirname(downloadTarget), path.basename(fullPath)));
                }

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

function getHashFromRemote(url, hashalgorithm, downloadTarget) {
    return new Promise((resolve, reject) => {
        const hasher = crypto.createHash(hashalgorithm.toLowerCase());
        hasher.setEncoding('hex');
        let writer = null;
        let settled = false;
        let hashFinished = false;
        let fileFinished = !downloadTarget;
        let remoteHash = null;

        const fail = error => {
            if(!settled) {
                settled = true;
                if(writer) {
                    writer.destroy();
                }
                reject(error);
            }
        };

        const tryResolve = () => {
            if(!settled && hashFinished && fileFinished) {
                settled = true;
                if(downloadTarget) {
                    console.log('\x1b[0m', 'Stored installer at ' + downloadTarget);
                }
                resolve(remoteHash);
            }
        };

        const remote = request(url)
            .on('response', response => {
                if(response.statusCode < 200 || response.statusCode >= 300) {
                    remote.abort();
                    fail(new Error(getHttpStatusMessage(url, response)));
                    return;
                }

                if(downloadTarget) {
                    writer = fsSync.createWriteStream(downloadTarget);
                    writer
                        .on('finish', () => {
                            fileFinished = true;
                            tryResolve();
                        })
                        .on('error', x => fail(new Error(`Failed to store ${url} at ${downloadTarget}: ${x.message}`)));

                    response.pipe(writer);
                }

                response
                    .on('error', x => fail(new Error(`Failed to read ${url}: ${x.message}`)))
                    .pipe(hasher)
                    .on('finish', () => {
                        remoteHash = hasher.read();
                        hashFinished = true;
                        tryResolve();
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

function getArgumentValue(names) {
    for(const name of names) {
        const value = getSingleArgumentValue(name);
        if(value) {
            return value;
        }
    }

    return null;
}

function getSingleArgumentValue(name) {
    const valuePrefix = name + '=';
    const inlineValue = process.argv.find(arg => arg.startsWith(valuePrefix));
    if(inlineValue !== undefined) {
        const value = inlineValue.substring(valuePrefix.length);
        if(!value) {
            console.log('\x1b[31m', `${name} requires a folder path.`);
            process.exit(1);
        }

        return value;
    }

    const index = process.argv.indexOf(name);
    if(index > -1) {
        const value = process.argv[index + 1];
        if(!value || value.startsWith('--')) {
            console.log('\x1b[31m', `${name} requires a folder path.`);
            process.exit(1);
        }

        return value;
    }

    return null;
}

function getDownloadTarget(manifestPath, manifest) {
    if(!downloadRoot) {
        return null;
    }

    const relativeManifestPath = path.relative(manifestsRoot, manifestPath);
    const relativeManifestDir = path.dirname(relativeManifestPath);
    const manifestName = sanitizePathSegment(path.basename(relativeManifestPath, path.extname(relativeManifestPath))) || 'manifest';
    const installerName = getInstallerFileName(manifest.Installer.URL);
    const targetParts = relativeManifestDir === '.'
        ? [manifestName, installerName]
        : [
            ...relativeManifestDir.split(path.sep).map(sanitizePathSegment).filter(x => x.length > 0),
            manifestName,
            installerName
        ];

    return path.join(downloadRoot, ...targetParts);
}

function getInstallerFileName(url) {
    try {
        const parsedUrl = new URL(url);
        const fileName = path.basename(decodeURIComponent(parsedUrl.pathname));
        return sanitizePathSegment(fileName) || 'installer';
    } catch(e) {
        return 'installer';
    }
}

function sanitizePathSegment(value) {
    const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    if(sanitized === '.' || sanitized === '..') {
        return '_';
    }

    return sanitized;
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
