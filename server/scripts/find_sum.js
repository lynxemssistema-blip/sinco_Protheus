const vals = [
    {id: '42767', val: 87046.77}, {id: '42768', val: 1803.27}, {id: '42769', val: 14956.55},
    {id: '42784', val: 7470.96}, {id: '42785', val: 379.05}, {id: '42795', val: 40162.62},
    {id: '42796', val: 1257.76}, {id: '42798', val: 2544.08}, {id: '42802', val: 3780.81},
    {id: '42803', val: 2179.34}, {id: '42804', val: 1345.00}, {id: '42813', val: 116287.92},
    {id: '42814', val: 1803.27}, {id: '42815', val: 42919.24}, {id: '42816', val: 9581.01},
    {id: '42819', val: 1331.68}, {id: '42839', val: 82604.42}, {id: '42840', val: 1803.27},
    {id: '42841', val: 91127.57}, {id: '42842', val: 493.42}, {id: '42846', val: 1046.00},
    {id: '42850', val: 8265.00}, {id: '42854', val: 19900.58}, {id: '42874', val: 1302.05},
    {id: '42882', val: 81376.94}, {id: '42883', val: 125901.79}, {id: '42884', val: 122.52},
    {id: '42885', val: 2694.19}
];
const target = 210095.44;

function findSubset(index, currentSum, currentSubset) {
    if (Math.abs(currentSum - target) < 0.01) {
        console.log("Found subset:", currentSubset.map(i => i.id + " (" + i.val + ")"));
        process.exit(0);
    }
    if (currentSum > target || index >= vals.length) return;

    // include
    currentSubset.push(vals[index]);
    findSubset(index + 1, currentSum + vals[index].val, currentSubset);
    currentSubset.pop();

    // exclude
    findSubset(index + 1, currentSum, currentSubset);
}

findSubset(0, 0, []);
console.log("Not found");
