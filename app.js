/**
 * NPM PACKAGES
 * Here are the following NPM Packages that we need to run our bot
 */
const restify = require("restify");
const builder = require("botbuilder");
const apiai = require("apiai");
const uuid = require("uuid/v1");

/**
 * MENU ITEMS
 * Data can also be retrieved from an API or from a database
 */
const menu = [
	{
		name: "Hot Chocolate",
		price: 80,
		description: "Decadent Hot Chocolate",
		image_link: "https://res.cloudinary.com/hackmnl/image/upload/v1553413811/hot_choco.jpg"
	},
	{
		name: "Latte",
		price: 120,
		description: "Best Latte in town",
		image_link: "https://res.cloudinary.com/hackmnl/image/upload/v1553413809/latte.gif"
	},
	{
		name: "Macchiato",
		price: 150,
		description: "Just like Starbucks",
		image_link: `https://res.cloudinary.com/hackmnl/image/upload/v1553413811/macchiato.jpg`
	}
];

/**
 * CHAT CONNECTOR
 * Here we configure the necessary information so our bot can function
 * The appId and appPassword can be found once you create an Azure Bot Service Bot
 * See link: https://azure.microsoft.com/en-us/services/bot-service/
 */
const connector = new builder.ChatConnector({
	appId: process.env.MicrosoftAppId,
	appPassword: process.env.MicrosoftAppPassword
});

/**
 * PORT
 * This is where our server will listen requests from
 * The default port for MSBF Bots is port 3978
 */
const port = process.env.PORT || 3978;

/**
 * BOT STORAGE CONFIGURATION
 * This is where we will save the user and conversation data
 * For Development Purposes we use the In-Memory Data Storage which is temporary and volatile
 * For Production we can store information in a Database
 */
const inMemoryStorage = new builder.MemoryBotStorage();

/**
 * BOT INITIALIZATION
 * This is where we initialize the bot
 */
const bot = new builder.UniversalBot(connector).set("storage", inMemoryStorage);

/**
 * RESTIFY SERVER
 * This is how we will be able to talk to our bot
 */
const server = restify.createServer();

/**
 * MESSAGING ENDPOINT
 * This will be the endpoint where we will receive the messages from the user
 * e.g. http://localhost:3978/api/messages
 */
server.post("/api/messages", connector.listen());

server.listen(port, () => {
	console.log(`Listening on port 3978!`);
});

/**
 * DIALOGFLOW SETUP
 * Configure the Dialogflow with the client access token
 * You can create a dialogflow agent to get the access token (Using the API V1)
 * Link: https://console.dialogflow.com/api-client/
 */
const df = apiai(process.env.DialogflowToken);

/**
 * BOT MIDDLEWARE
 * Every message that comes in and out of the bot will be seen here
 * You can process the messages before going to a dialog
 */
bot.use({
	botbuilder: (session, next) => {
		var start = /^restart|started|get started|start over|start|get_started/i.test(
			session.message.text
		);

		if (start) {
			session.beginDialog("/start");
		} else {
			next();
		}
	}
});

// DIALOGS

// This is the main dialog
bot.dialog("/", [
	async session => {
		let intentResult = await detectIntent(session.message.text);
		session.send(intentResult);
	}
]);

bot.dialog("/start", [
	session => {
		//Initialize the cart
		session.userData.cart = [];
		session.send(`Welcome to the Demo Coffee Bot!`);
		builder.Prompts.text(session, "What is your name?");
	},
	(session, results) => {
		session.userData.name = results.response;
		builder.Prompts.choice(
			session,
			`Hello ${results.response}! What can I do for you today?`,
			["View Menu"],
			{ listStyle: builder.ListStyle.button }
		);
	},
	(session, results) => {
		let items = [];

		menu.forEach(element => {
			items.push(
				new builder.HeroCard(session)
					.title(element.name)
					.subtitle(element.description)
					.images([builder.CardImage.create(session, element.image_link)])
					.buttons([
						builder.CardAction.imBack(session, `${element.name}`, `Buy - Php${element.price}`)
					])
			);
		});

		let msg = new builder.Message(session)
			.attachmentLayout(builder.AttachmentLayout.carousel)
			.attachments(items);

		let choices = [];

		menu.forEach(element => {
			choices.push(element.name);
		});

		builder.Prompts.choice(session, msg, choices, {
			listStyle: builder.ListStyle.button,
			maxRetries: 0
		});
	},
	(session, results) => {
		let item = menu.find(element => {
			return element.name == results.response.entity;
		});

		session.send(
			`You have ordered a ${item.name}. Please pay Php${
				item.price
			} to the counter and kindly wait for your order! Thank you for using the Coffee Bot!`
		);
	}
]);

/**
 * DETECT INTENT FUNCTION
 * Using the Dialogflow NodeJS SDK
 * @param {string} query
 */
async function detectIntent(query) {
	let request = df.textRequest(query, {
		sessionId: uuid()
	});
	return new Promise((resolve, reject) => {
		request.on("response", res => {
			resolve(res.result.fulfillment.speech);
		});

		request.on("error", err => {
			reject(err);
		});

		request.end();
	});
}
