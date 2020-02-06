const AssertionError = require('assertion-error');

const expectRevert = async function (promise, expectedError) {
    try {
        await promise;
    } catch (error) {
        if (!error.message.includes(expectedError)) {
            if(error.reason){            
                throw new AssertionError('Expected different fail reason', {
                    actual: error.reason, 
                    expected: expectedError,
                    showDiff: true
                });
            }else{
                console.log($error);
                throw new AssertionError(`Expected different fail reason. Expected:\n${expectedError}\nReceived:${error.message}`);
            }
        }
        return;
    }
    throw new AssertionError('Expected an exception but none was received');
};

module.exports = expectRevert;