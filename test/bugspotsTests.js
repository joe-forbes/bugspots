/**
 * Created by joe on 4/1/15.
 */
var nockExec = require('nock-exec');
var logger = require('../util/logger');
var testCommits = require('../resources/test/testCommits.json');

logger.addTarget({
  targetType: 'file', targetConfig: {
    level: 'debug',
    filename: './test.log',
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false
  }
});

logger.addTarget({
  targetType: 'console'
});

testCommits.forEach(function(testCommit) {
  testCommit.parents = function() {
    return testCommit.parentCommits;
  };
  testCommit.committed_date = new Date(testCommit.committed_date);
});

var proxyquire = require('proxyquire');

var giftStub = function() {
  //what's needed here?
  return {
    branch: function(branch, headCommitHandler){
      headCommitHandler(null, {commit: testCommits[0]});
    },

    commits: function(commitId, depthToRetrieve, commitListHandler){
      commitListHandler(null, testCommits);
    }
  };

};

var Bugspots = proxyquire('../lib/bugspots', {
  'gift': giftStub
});

nockExec('git diff commit1..commit2 --name-only').reply(0, 'file1\n');
nockExec('echo \'\'').reply(0, '\n');
nockExec('echo \'\'').reply(0, '\n');
nockExec('echo \'\'').reply(0, '\n');

describe('bugspots tests', function() {

  it('should not blow up when you call it.', function(done){
    var scanner = new Bugspots();

    var options = {depth: 2};

    var processResults = function (err, hotspots) {
      if (err) {
        console.error(err.message);
        return;
      }
      hotspots.forEach(function (hotspot) {
        console.log(hotspot.file  + '\t' + hotspot.fixCommits + '\t' + hotspot.firstCommit.toISOString() + '\t' + hotspot.lastCommit.toISOString() + '\t' + hotspot.score);
      });
      done();
    };

    scanner.scan(options, processResults);

  });
});
