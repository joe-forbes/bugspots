/**
 * Created by joe on 4/1/15.
 */
var logger = require('../util/logger');

logger.addTarget({
  targetType: 'file', targetConfig: {
    level: 'debug',
    filename: './test.log',
    handleExceptions: true,
    json: false,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false
  }
});

//logger.addTarget({targetType: 'console'});

var testResources = require('../resources/test/bugspotsTestResources2.json');

testResources.commitSets.forEach(function (commitSet) {
  commitSet.forEach(function (testCommit) {
    testCommit.committed_date = new Date(testCommit.committed_date);
    testCommit.parents = function () {
      return testCommit.parentCommits;
    }
  });
});

var proxyquire = require('proxyquire');

var commitSetIndex = -1;

var giftStub = function () {
  return {
    branch: function (branch, headCommitHandler) {
      headCommitHandler(null, testResources.branch);
    },

    commits: function (commitId, depthToRetrieve, commitListHandler) {
      commitSetIndex++;
      commitListHandler(null, testResources.commitSets[commitSetIndex]);
    }
  }
};

var childProcessStub = {
  exec: function (cmd, opt, callback) {
    function go() {
      logger.debug('processing command: ' + cmd);
      callback(null, testResources.diffCommands[cmd].replace(/\\n/g, '\n'));
    }
    setTimeout(go, 100);
  }
};

var Bugspots = proxyquire('../lib/bugspots', {
  'gift': giftStub,
   'child_process': childProcessStub
});

describe('bugspots tests', function () {

  it('should not blow up when you call it.', function (done) {
    var scanner = new Bugspots();

    var options = {
      repo: '/home/joe/git/github/django/django-trunk',
      branch: 'stable/1.7.x',
      regex: /\b(fix(es|ed)?|close(s|d)?)\b/i,
      useRelativeDates: true,
      markerCommitId: '159f3bfafced8b546010caeaafabecf735598e34', //1.7.7
//  markerCommitId: '40fb8f4ecd740cbfc2b2c3651d69cbbb3cc2506b', //1.7.6
//  markerCommitId: '634f4229c5cafeb3a1c03e5deb9434d7c0f74ebe', //1.7.5
//  markerCommitId: 'b626c289ccf9cc487f97d91c2a45cac096d9d0c7', //1.7.4
//  markerCommitId: '6bf1930fb5c7c6a47992ff368e21c58f4f14b402', //1.7.3
//  markerCommitId: '880d7638cf66ed28a60b62335ccfc5dfd5052937', //1.7.2
//  markerCommitId: 'c5780adeecfbd85a80b5aa7130dd86e78b23e497', //1.7.1
//  markerCommitId: 'd92b08536d873c0966e8192e64d8e8bd9de79ebe', //1.7
      depth: 10,
      batchSize: 5
    };

    var processResults = function (err, hotspots) {
      if (err) {
        console.error(err.message);
        return;
      }
      hotspots.forEach(function (hotspot) {
        logger.debug(JSON.stringify(hotspot));
        console.log(hotspot.file + '\t' + hotspot.fixCommits + '\t' + hotspot.firstCommit.toISOString() + '\t' + hotspot.lastCommit.toISOString() + '\t' + hotspot.score);
      });
      done();
    };

    scanner.scan(options, processResults);

  });
});
