const fs = require("fs");
const path = require("path");
const child = require("child_process");
const readline = require("readline");
const os = require("os");
const OTPAuth = require("otpauth");
const PNG = require("pngjs").PNG;
const {
	QRCodeReader,
	RGBLuminanceSource,
	HybridBinarizer,
	BinaryBitmap
} = require("@zxing/library");

const MESSAGES = {
	MAIN: "\nMENU\n====\n0) Capture QRCode\n1) Generate Token",
	WAITING: "\n**Waiting for screenshot**",
	SELECT: "\nSelect Issuer:\n",
	JAVA_HOME_MISSING: "Warning: JAVA_HOME environment variable not found!",
	JAVA_MISSING: "Warning: Java not found!",
	NOT_COMPILED: "Warning: ClipboardTools.jar missing! You need to execute 'npm run build' first.",
	COPY_TOKEN: "Press <c> to copy this token to the clipboard"
};

if (fs.existsSync("./settings.json") == false) {
	fs.writeFileSync("settings.json", JSON.stringify({
		version: 1,
		accounts: []
	}));
}

let settings = JSON.parse(fs.readFileSync("settings.json"));
let interval, options, selectedAccount, token;
let menu = "main";
let oldClipboardContent = "";

function generateToken(index) {
	if (index > settings.accounts.length - 1) {
		return;
	}
	console.log("\n");
	menu = "generateToken";
	let options = JSON.parse(JSON.stringify(settings.accounts[index]));
	options.secret = OTPAuth.Secret.fromBase32(options.secret);
	const totp = new OTPAuth.TOTP(options);

	token = "";
	interval = setInterval(() => {
		token = totp.generate();
		process.stdout.write(`TOKEN: ${token} (${MESSAGES.COPY_TOKEN})\r`);
	}, 1000);
}

function addAccount(index = -1) {
	if (index == -1) {
		settings.accounts.push(options);
	} else {
		settings.accounts[index] = options;
	}
	fs.writeFileSync("settings.json", JSON.stringify(settings));
	menu = "main";
	console.log(MESSAGES.MAIN);
}

function exit(msg = "") {
	console.log(msg);
	process.exit();
}

if (process.env.JAVA_HOME == null) {
	exit(MESSAGES.JAVA_HOME_MISSING);
}
const java = path.join(process.env.JAVA_HOME, "bin", os.platform() == "win32" ? "java.exe" : "java");
if (!fs.existsSync(java)) {
	exit(MESSAGES.JAVA_MISSING);
}
if (!fs.existsSync("./java/ClipboardTools.jar")) {
	exit(MESSAGES.NOT_COMPILED);
}

console.log(MESSAGES.MAIN);

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
	process.stdin.setRawMode(true);
}

process.stdin.on("keypress", (chunk, key) => {
	if (key) {
		switch (key.name) {
			case "q":
				exit();
				break;

			case "escape":
				if (menu == "capture" || menu == "generateToken") {
					menu = "main";
					clearInterval(interval);
					console.log(MESSAGES.MAIN);
				} else {
					exit();
				}
				break;

			case "0":
				if (menu == "main") {
					menu = "capture";
					console.log(MESSAGES.WAITING);
					interval = setInterval(async () => {
						const clipboardContent = child.execFileSync(java, ["-jar", path.join(__dirname, "java/ClipboardTools.jar"), "copy"], {
							encoding: "utf8"
						});

						if (clipboardContent.length > 0 && clipboardContent != oldClipboardContent) {
							const png = PNG.sync.read(Buffer.from(clipboardContent, "base64"));

							const len = png.width * png.height;
							const luminances = new Uint8Array(len);
							for (let i = 0; i < len; i++) {
								luminances[i] = ((png.data[i * 4] + png.data[i * 4 + 1] * 2 + png.data[i * 4 + 2]) / 4) & 0xFF;
							}

							const luminanceSource = new RGBLuminanceSource(luminances, png.width, png.height);
							const hybridBinarizer = new HybridBinarizer(luminanceSource);
							const binaryBitmap = new BinaryBitmap(hybridBinarizer);

							let result = {
								text: ""
							};
							try {
								const codeReader = new QRCodeReader();
								result = codeReader.decode(binaryBitmap);
							} catch (error) {}

							if (result.text.indexOf("otpauth://totp/") != -1) {
								console.log("\ntext: " + result.text);
								clearInterval(interval);
								options = {
									issuer: "",
									account: "",
									secret: "",
									algorithm: "SHA1",
									digits: 6,
									period: 30
								};

								result.text = result.text.replace("otpauth://totp/", "");
								const label = result.text.split("?")[0];
								if (label.indexOf(":") != -1) {
									options.issuer = label.split(":")[0];
									options.account = label.split(":")[1];
								} else {
									options.account = label;
									options.issuer = "";
								}
								result.text.split("?")[1].split("&").flatMap(el => [{
									key: el.split("=")[0].toLowerCase(),
									value: el.split("=")[1]
								}]).forEach(parameter => {
									switch (parameter.key) {
										case "secret":
											options.secret = parameter.value;
											break;

										case "issuer":
											options.issuer = parameter.value;
											break;

										case "digits":
											options.issuer = parseInt(parameter.value);
											break;

										case "period":
											options.period = parseInt(parameter.value);
											break;

										case "algorithm":
											options.algorithm = parameter.value;
											break;
									}
								});

								selectedAccount = settings.accounts.findIndex(el => el.issuer == options.issuer && el.account == options.account);
								if (selectedAccount != -1) {
									console.log(`\nWARNING! account=${options.account}, issuer: ${options.issuer} already exists!\nDo you want to overwrite the existing (y/n)?`);
								} else {
									console.log(`\nAdding account=${options.account}, issuer: ${options.issuer}`);
									addAccount();
								}
							}
						}
						if (clipboardContent != "") {
							oldClipboardContent = clipboardContent;
						}
					}, 750);
				} else if (menu == "selectIssuer") {
					generateToken(parseInt(key.name));
				}
				break;

			case "1":
				if (menu == "main") {
					if (settings.accounts.length != 0) {
						menu = "selectIssuer";
						console.log(MESSAGES.SELECT);
						settings.accounts.forEach((account, index) => {
							console.log(`${index}) account: ${account.account}, issuer: ${account.issuer}`);
						})
					}

				} else if (menu == "selectIssuer") {
					generateToken(parseInt(key.name));
				}
				break;

			case "y":
				if (menu == "capture") {
					addAccount(selectedAccount);
				}
				break;

			case "n":
				if (menu == "capture") {
					menu = "main";
					console.log(MESSAGES.MAIN);
				}
				break;

			case "c":
				if (menu == "generateToken" && token != "") {
					child.execFileSync(java, ["-jar", path.join(__dirname, "java/ClipboardTools.jar"), "paste", token]);
				}
				break;

			default:
				if (isNaN(parseInt(key.name)) == false) {
					generateToken(parseInt(key.name));
				}
				break;
		}
	}
});