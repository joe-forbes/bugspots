/* configger.js
 * Reads configuration using nconf. Originally based on andrewrk's answer at: http://stackoverflow.com/questions/5869216/how-to-store-node-js-deployment-settings-configuration-files
 * 
 * Precedence: command line, config file, defaults supplied by application. 
 * 
 * Config file can be specified on command line using --configFile <file>, or as an environment variable using configFile=<file>. If not specified, uses "config.json" in app directory.
 * 
 * Note: it is not possible to use environment variables to set individual configuration options - the only way to affect configuration from environment variables is to set the configFile 
 * environment variable. In general, I am suspicious of environment variables - they are too global in scope to feel safe to me. The only reason I'm supporting any use of environment
 * variables is that there is no other way to affect configuration when calling "npm start".
 *  
 * Default behavior of nconf is to silently fail if the config file can't be found.  This seems wrong to me, so I'm changing things to throw an error. 
 * There is still a potential for a race condition if the file is deleted after the check for its existence. Adjusting for this would be more work than it's 
 * worth IMO, especially since the primary failure mode is that the specified file  _never_ existed, because the value supplied is the result of
 * a random mess-up on the user's part. 
 */

var nconf = require("nconf");
var fs = require("fs");

var configger = {
  load : function(defaults) {
    nconf.argv().env({
      whitelist : [ "configFile" ]
    });

    var configFile = "config.json";

    if (nconf.get("configFile")) {
      configFile = nconf.get("configFile");
    }

    if (!fs.existsSync(configFile)) {
      throw {
        name : "FileNotFoundException",
        message : "Unable to find configFile " + configFile
      };
    }

    nconf.file(configFile);

    nconf.defaults(defaults);

    return nconf.get();
  }
};

module.exports = configger;