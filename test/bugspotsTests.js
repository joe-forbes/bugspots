'use strict';

//TODO: copying and pasting JSDoc typedef has got to be the wrong thing to do!
/**
 * @typedef {object} TestResources
 * @property {object} testCases
 * @property {object[]} commitArray
 * @property {object} commitLookup
 * @property {object} commitAliases
 * @property {object} diffCommands
 */

var should = require('chai').should(),
    proxyquire = require('proxyquire'),
    testResourcesLoader = require('./testResourcesLoader'),
    /** @type {TestResources} */
    testResources = testResourcesLoader.load('../resources/test/bugspotsTestResources.json'),
    logger = require('../util/logger'),
    giftStub,
    childProcessStub,
    Bugspots;

logger.addTarget({
    targetType: 'file', targetConfig: {
        level: 'debug',
        filename: './logs/test.log',
        handleExceptions: true,
        json: false,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        colorize: false
    }
});

giftStub = function () {
    return {
        getCommitIndex: function (commitId) {
            if (!testResources.commitLookup.hasOwnProperty(commitId)) {
                commitId = testResources.commitAliases[commitId];
            }
            return testResources.commitLookup[commitId];
        },
        commits: function (commitId, depthToRetrieve, skip, commitListHandler) {
            var startIndex = this.getCommitIndex(commitId) + skip,
                commitSet = testResources.commitArray.slice(startIndex, startIndex + depthToRetrieve);
            commitListHandler(null, commitSet);
        }
    }
};

//noinspection JSUnusedGlobalSymbols
childProcessStub = {
    exec: function (cmd, opt, callback) {
        function go() {
            if (!testResources.diffCommands.hasOwnProperty(cmd)) {
                logger.warn('Results not found for cmd: ' + cmd);
                callback(new Error('Diff results not found for cmd: ' + cmd));
                return;
            }
            callback(null, testResources.diffCommands[cmd].replace(/\\n/g, '\n'));
        }

        setTimeout(go, 100);
    }
};

Bugspots = proxyquire('../lib/bugspots', {
    'gift': giftStub,
    'child_process': childProcessStub
});

describe('Bugspots basic tests', function () {

    it('should look for "master" if no "branch" option supplied.', function (done) {
        var testCaseName = 'defaultBranchTest',
            scanner,
            processResults;

        logger.info(testCaseName);
        scanner = new Bugspots();

        processResults = function (err, hotspots) {
            if (err) {
                throw err;
            }
            hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
            done();
        };
        scanner.scan(testResources.testCases[testCaseName].options, processResults);
    });

    it('should work for at least one configuration.', function (done) {
        var testCaseName = 'basicTest',
            scanner,
            processResults;

        logger.info(testCaseName);
        scanner = new Bugspots();

        processResults = function (err, hotspots) {
            if (err) {
                throw err;
            }
            hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
            done();
        };
        scanner.scan(testResources.testCases[testCaseName].options, processResults);
    });

    it('should retrieve fewer hotspots if the tail commit is found.', function (done) {
        var testCaseName = 'tailCommitHotspotCount',
            scanner,
            processResults;

        logger.info(testCaseName);
        scanner = new Bugspots();

        processResults = function (err, hotspots) {
            if (err) {
                throw err;
            }
            hotspots.length.should.equal(6);
            done();
        };
        scanner.scan(testResources.testCases[testCaseName].options, processResults);
    });

    it('should get the right hotspots if the tail commit is found.', function (done) {
        var testCaseName = 'tailCommitHotspots',
            scanner,
            processResults;

        logger.info(testCaseName);
        scanner = new Bugspots();

        processResults = function (err, hotspots) {
            if (err) {
                throw err;
            }
            hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
            done();
        };
        scanner.scan(testResources.testCases[testCaseName].options, processResults);
    });

    it('should translate tail commit alias to tail commit id.', function (done) {
        var testCaseName = 'tailCommitAlias',
            scanner,
            processResults;

        logger.info(testCaseName);
        scanner = new Bugspots();

        processResults = function (err, hotspots) {
            if (err) {
                throw err;
            }
            hotspots.should.eql(testResources.testCases[testCaseName].hotspots);
            done();
        };
        scanner.scan(testResources.testCases[testCaseName].options, processResults);
    });

});
