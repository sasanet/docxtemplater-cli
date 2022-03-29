
const counterMap = {}

const addFilters = (expressions) => {
    expressions.filters.counter = function (input) {
        if(input in counterMap) {
            return counterMap[input] += 1
        } else {
            return counterMap[input] = 1
        }
    };
}
module.exports = {
    addFilters
}