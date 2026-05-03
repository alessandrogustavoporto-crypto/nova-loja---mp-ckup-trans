
const Promise = require('promise');
let bannersChanged = true;
Promise.all([
    Promise.resolve(true),
    Promise.resolve(true),
    Promise.resolve(),
    Promise.resolve()
]).then(([p, b]) => {
    console.log('p:', p, 'b:', b);
});

