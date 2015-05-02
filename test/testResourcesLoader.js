/**
 * @typedef {object} TestCommit
 * @type {object}
 * @property {string[]} parentCommits
 * @property {date|string} committed_date
 * @property {function} parents
 */

/**
 * @typedef {object} TestResources
 * @property {object} testCases
 * @property {object[]} commitArray
 * @property {object} commitLookup
 */

/**
 * @typedef {object} TestCase
 * @property {object} regexSpec
 * @property {object} options
 */

var testResourcesLoader = {
    load: function (file) {
        /** @type {TestResources} */
        var testResources = require(file),
            names,
            i,
            /** @type {TestCase} */
            testCase,
            pattern,
            options;

        testResources.commitArray = [];
        testResources.commitLookup = {};

        testResources.commits.forEach(
            /**
             * @param {TestCommit} testCommit
             */
            function (testCommit) {
                testResources.commitArray.push(testCommit);
                testResources.commitLookup[testCommit.id] = testResources.commitArray.length - 1;
                testCommit.committed_date = new Date(testCommit.committed_date);
                testCommit.parents = function () {
                    return testCommit.parentCommits;
                }
            }
        );

        names = Object.getOwnPropertyNames(testResources.testCases);
        for (i = 0; i < names.length; i++) {
            testCase = testResources.testCases[names[i]];
            testCase.hotspots.forEach(function (hotspot) {
                hotspot.firstCommit = new Date(hotspot.firstCommit);
                hotspot.lastCommit = new Date(hotspot.lastCommit);
            });

            if (testCase.options.hasOwnProperty('regexSpec')) {
                pattern = testCase.options.regexSpec.pattern;
                options = testCase.options.regexSpec.options;
                testCase.options.regex = new RegExp(pattern, options);
            }

        }

        return testResources;
    }
};

module.exports = testResourcesLoader;