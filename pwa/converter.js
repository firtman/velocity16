var rate = "http://api.fixer.io/latest";
var input;
var output; 

window.addEventListener("DOMContentLoaded", function() {
    input = document.getElementById("eur");
    output = document.getElementById("usd");
    document.querySelector("input[type=button]")
        .addEventListener("click", convert);
})

function convert() {
    output.innerHTML = "...";
    fetch(rate)
        .then(function(response) {
            response.json().then(function(json) {
                output.innerHTML = (json.rates.USD*parseFloat(input.value)).toFixed(2) + " USD";
            })
        })
        .catch(function(e) {
            console.log(e);
            output.innerHTML = "Error";
        })
}