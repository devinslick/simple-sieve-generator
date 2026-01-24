
const line = "!auto,credit,entertainment,food,receipt,service,services,shop,travel,streaming,shopping!FRASD deal";
const regex = /^!([^!]+)!([a-zA-Z0-9]+)(?:\s+(.+))?$/;
const match = line.match(regex);

console.log("Line:", line);
console.log("Match:", match);

if (match) {
    console.log("Aliases:", match[1]);
    console.log("Code:", match[2]);
    console.log("Args:", match[3]);
} else {
    console.log("NO MATCH");
}
