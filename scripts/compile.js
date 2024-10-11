const fs = require("fs");
const path = require("path");
const os = require("os");
const child = require("child_process");

if (process.env.JAVA_HOME == null) {
	console.log("Warning: JAVA_HOME environment variable not found!");
	process.exit();
}
let javac = path.join(process.env.JAVA_HOME, "bin", os.platform() == "win32" ? "javac.exe" : "javac");
let jar = path.join(process.env.JAVA_HOME, "bin", os.platform() == "win32" ? "jar.exe" : "jar");

if (!fs.existsSync(javac) || !fs.existsSync(jar)) {
	console.log("Warning: Java not found!");
	process.exit();
}

child.execFileSync(javac, ["ClipboardTools.java"], {
	encoding: "utf8",
	cwd: path.join(__dirname, "../java")
});
child.execFileSync(jar, ["cfe", "ClipboardTools.jar", "ClipboardTools", "ClipboardTools.class"], {
	encoding: "utf8",
	cwd: path.join(__dirname, "../java")
});
if (!fs.existsSync(path.join(__dirname, "../java/ClipboardTools.jar"))) {
	console.log("Something went wrong!");
}