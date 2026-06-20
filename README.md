# Welcome to the N.I.N.A. Community Plugin Repository
Inside this repository all plugin manifests for the N.I.N.A. application are found. All plugin manifests inside this repository are put onto the N.I.N.A. server to be used to show and install plugins inside the N.I.N.A. application

N.I.N.A. - Nighttime Imaging 'N' Astronomy - is an open source astrophotography imaging suite. You can find the source code [here](https://github.com/isbeorn/nina)

# Submitting a plugin manifest
To make a plugin available you can submit a manifest into this repository, by following the basic steps:
1. Meet the prerequisites
2. Develop a plugin  
3. Create a manifest  
4. Test your manifest against the schema  
5. Submit a pull request against this repository with your manifest  
6. Wait for the pull Request to be reviewed and merged

# Meet the prerequisites

N.I.N.A. is free open source software. The spirit of open source is highly encouraged when writing a plugin for N.I.N.A. and an appropriate open source license should be chosen. [MIT](https://opensource.org/licenses/MIT), [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause) and [MPL-2.0](https://opensource.org/licenses/MPL-2.0) are some of the popular choices, to name a few - choose whichever fits best for your needs.  

Having a plugin as open source doesn't necessarily mean that it cannot be used for commercial purposes. Maybe it will interface with an online service that has a subscription model or it is interfacing with a closed source app, to give a few examples. In this case the plugin is just the mediator between the two worlds. The intent to be as open as possible should be clear.  

**Closed source plugins will not be accepted for the manifest repository and no support in any form will be given by the community.**  
*It should be mentioned that if the number of closed source plugins get out of hand, further restrictions might be added to these in the future, as this would contradict the open source intent of the N.I.N.A. project*

# Develop a plugin
For more details on how to develop a plugin, there is a separate repository containing a basic template using a visual studio extension and guidelines to follow.  
The repository can be found [here](https://github.com/isbeorn/nina.plugin.template)

# Fork the repository
To be able to submit a pull request, the repository needs to be forked first.  
How to fork a repository is described [here](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)

# Create a manifest
A manifest file contains a JSON describing all the necessary metadata of a plugin. 
To create a manifest, you can either use the [powershell script](https://github.com/isbeorn/nina.plugin.manifests/blob/main/tools/CreateManifest.ps1) or alternatively follow the manual steps. (requires Powershell version 7)  

***Make sure that your DLL will not be recompiled or changed after the manifest is created, as the checksum will change each time!***

## Using a github action or bitbucket pipeline - *recommended*
### Github
- Copy the file in `./tools/github-action.yml` into `.github/workflows` folder of your plugin repository.  
- Change github actions permissions in the repository settings > Actions > General > Workflow permissions to "Read and write permissions".  
- Adjust the yaml file according to the comments to match the requirements for your plugin.  
- The action will run when you push a new version tag.  
- Once the release is generated you can submit the manifest file to the manifest repository.

### Bitbucket
- ⚠️Bitbucket free plans no longer support files in the download section. Use bitbucket only if you have a paid subscription!
- Copy the file in `./tools/bitbucket-pipelines.yml` into the root of your plugin repository.  
- Adjust the yaml file according to the comments to match the requirements for your plugin.  
- You'll have to trigger the pipeline manually once you are ready to publish a new version.  
- Once the release is generated you can submit the manifest file to the manifest repository.

## Using the powershell script
This is the most simple way of creating the manifest file. It will make use of the compiled assembly and its meta data attributes and will fill out most of the manifest with the available meta data.
The only thing that needs to be added manually is the installer URL which points to the location where the plugin dll is hosted online - a script parameter to directly insert this is also available. Alternatively there is an option to directly upload to bitbucket and the URL will be generated.
The script has the following set of parameters:

`-file` - **required**

The path to your compiled plugin DLL to create the manifest for

`-installerUrl` 

A URL pointing to the plugin where it can be downloaded

`-createArchive` 

Add this if the dll should be bundled into a zip archive

`-archiveName`

Name of the created zip archive. When this parameter is omitted the plugin DLL file name without its extension is used as a name.

`-includeAll`

Include all files in the folder of the file into the archive

`-appendVersionToArchive`

When set, the archive will have the plugin version appended to the file name (e.g. MyPlugin.zip -> MyPlugin.1.0.0.0.zip)

`-uploadToBitbucket`

If the file should be directly pushed to your bitbucket download section


`-bitbucketUserName` **required when uploadToBitbucket is passed**

Your bitbucket user name

`-bitbucketPassword` **required when uploadToBitbucket is passed**

Your bitbucket app password to upload (see https://support.atlassian.com/bitbucket-cloud/docs/create-an-app-password/)

`-bitbucketRepositoryOwner` **required when uploadToBitbucket is passed**

The owner of the repository

`-bitbucketRepository` **required when uploadToBitbucket is passed**

The name of the repository

`-beta`

Marks the manifest for the Beta channel

### Example usage

*Creating a manifest out of a plugin DLL that has no further included files*  
`.\tools\CreateManifest.ps1 -file C:\Users\Isbeorn\AppData\Local\NINA\Plugins\Orbuculum.1.0.3.3.dll -installerUrl https://bitbucket.org/Isbeorn/nina.plugin.orbuculum/downloads/Orbuculum.1.0.3.3.dll`

*Creating an archive and the matching manifest based on the plugin DLL and all files inside the plugin folder*  
`.\tools\CreateManifest.ps1 -createArchive -includeAll -file "C:\Users\Isbeorn\AppData\Local\NINA\Plugins\PixInsight Tools\PixInsightTools.0.1.6.1.dll" -installerUrl https://bitbucket.org/Isbeorn/nina.plugin.pixinsighttools/downloads/PixInsightTools.0.1.6.1.zip`

## Manually generate the file

While not recommended, it is possible to manually create the manifest by using your favorite tool. The manifest needs to follow the specifications that are described further below. It is important that the manifest follows the assembly meta data. Especially the "Identifier" and "Name" needs to be the same as inside the plugin assembly meta data. The rest can deviate from it, although strongly discouraged.

## Manifest specification

As specified in the [JSON Schema](https://github.com/isbeorn/nina.plugin.manifests/blob/main/manifest.schema.json) the manifest consists of a set of required and optional parameters. Each version of your plugin should have a separate manifest, or alternatively when you only want to support one leading version, one manifest that will be updated constantly with the newest version should be maintained.

`Name` - **Required**

The name of your plugin. This name will be used by the N.I.N.A. plugin manager to show inside the list of plugins as well as using the name as a folder name for putting the plugin content inside the general plugin folder

`Identifier` - **Required**

This is a unique identifier - using a GUID - of your plugin and must not be changed throughout the lifetime of your plugin for version increases. It is used to identify your assembly during the installation and de-installation process.

`Author` - **Required**

The author (you) of the plugin

`License` - **Required**

A short name of the license in use (e.g.  MPL-2.0, MS-PL, MIT)

`LicenseURL` - **Required**

Link leading to the license text

`ChangelogURL`

If you want to maintain a list of detailed changelogs you can add a url to your manifest that leads to the list of changes

`Repository` - **Required**

A link to the remote repository, where the source code of the plugin is available

`Version` - **Required**

It consists of four sub attributes (Major, Minor, Patch and Build) describing the plugin version.

`MinimumApplicationVersion` - **Required**

This field describes the minimum version of N.I.N.A. that this plugin is compatible with. Similar to the plugin version it consists of four sub attributes (Major, Minor, Patch and Build).  
If multiple versions of a plugin are available, the plugin manager inside the application will serve the plugin manifest with the highest version that is compatible with the currently running application using the minimum application version.

`Installer.URL` - **Required**

A URL pointing to the plugin to download

`Installer.Type` - **Required**

Defines the type of the hosted plugin. Currently a direct DLL or a zip ARCHIVE is supported. This is used by the plugin manager to know which type of operation needs to be taken to install the plugin correctly.

`Installer.Checksum` - **Required**

The checksum of the remote file. If the checksum does not match the file download, the installation of a plugin via the plugin manager will fail.

`Installer.ChecksumType` - **Required**

The algorithm used to create the file checksum. Supported algorithms: MD5, SHA1, SHA256

`Tags`

Some quick search terms to enable users to quickly search for

`Homepage`

Homepage of the plugin creator where the plugin and more is found

`Descriptions.ShortDescription` - **Required**

A quick summary of your plugin's capabilities and features

`Descriptions.LongDescription`

An in-depth description of your plugin, with all the content description that is part of the plugin

`Descriptions.FeaturedImageURL`

URL to a logo for the plugin. This image will be shown prominently in the app next to the name 

`Descriptions.ScreenshotURL`

An image URL showing the plugin in action

`Descriptions.AltScreenshotURL`

An alternative image URL showing the plugin in action from a different angle compared to the ScreenshotURL

# Test your manifest

The manifest repository has a script, that will gather all available manifests inside the repository, validate their content based on the schema definition and then puts all valid schemas into a big manifest file for upload to the server.
This script can also be used to test your manifest, that it is valid.
For the script to be able to run you need to install [nodeJS](https://nodejs.org/en/) and install the dependencies.
```bash
# if you have not installed nodejs yet, you can easily do so using winget (for windows)
winget install nodejs

# install dependencies via node package manager
npm install

# run the node script to validate manifests
node gather.js
```
The log console will then output all found manifests and logs if they are valid or not. If your manifest is shown as valid you are ready to create your pull request.

# Submit a pull request

- Make sure that the manifest is valid
- Your manifest should be put into the folder path matching the following pattern `manifests\<plugin starting letter><your plugin name>\<nina version>\<your plugin version>\manifest.json`. If you do not want to maintain multiple versions, you can omit the version folder.
- Once changes are submitted to your fork you can create a pull request inside the main manifest repository
- The pull request will undergo a review process. Be prepared to respond to feedback.

# Releasing a Manifest as a Beta Version

To release a version of your plugin in a separate beta channel for opt-in users, follow these steps:

## Step 1: Add the Channel Property

In your manifest file, add the following property:
```json
    "Channel": "Beta"
```

# Releasing a manifest as a beta version

To release a version of your plugin in a separate beta channel for users to opt-in, you can submit your manifest with an additional property.

## Channel Property

Add `Channel` property to your manifest.json and set its value to `Beta`. Then the manifest will be put into the beta channel instead of the release channel.

## Opt-In to beta channel

A user can opt-into the beta channel by adding "https://nighttime-imaging.eu/wp-json/nina/v1/beta" as a Plugin Repository inside N.I.N.A.
1. Open N.I.N.A.
2. Navigate to Options > General > Plugin Repositories
3. Click on the `+`
4. Enter the url `https://nighttime-imaging.eu/wp-json/nina/v1/beta`
5. Head to the plugin manager and check for updates to receive beta versions
