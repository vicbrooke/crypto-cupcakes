require("dotenv").config(".env");
const cors = require("cors");
const express = require("express");
const app = express();
const morgan = require("morgan");
const { PORT = 3000 } = process.env;
const jwt = require("jsonwebtoken");

const { User, Cupcake } = require("./db");
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require("express-openid-connect");

// middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
// follow the docs:
// define the config object
// attach Auth0 OIDC auth router
// create a GET / route handler that sends back Logged in or Logged out

const { BASE_URL, CLIENT_ID, ISSUER_BASE_URL, SECRET, JWT_SECRET } =
  process.env;

const config = {
  // change authRequired to false to allow post request to work
  authRequired: true,
  auth0Logout: true,
  baseURL: BASE_URL,
  clientID: CLIENT_ID,
  issuerBaseURL: ISSUER_BASE_URL,
  secret: SECRET,
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// This first piece of middleware needs commenting out to allow post request to work
app.use(async (req, res, next) => {
  try {
    const [user] = await User.findOrCreate({
      where: {
        username: req.oidc.user.nickname,
        name: req.oidc.user.name,
        email: req.oidc.user.email,
      },
    });
    next();
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// req.isAuthenticated is provided from the auth router
app.get("/", (req, res) => {
  res.send(
    req.oidc.isAuthenticated()
      ? `<h1>My Web App</h1><h2>Welcome, ${req.oidc.user.name}</h2><h3>Username: ${req.oidc.user.nickname}</h3><h4>${req.oidc.user.email}</h4><img src=${req.oidc.user.picture} alt="user image" width="150">`
      : "Logged out"
  );
});

app.get("/cupcakes", async (req, res, next) => {
  try {
    const cupcakes = await Cupcake.findAll();
    res.send(cupcakes);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.get("/me", async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: {
        username: req.oidc.user.nickname,
      },
      raw: true,
    });
    if (user) {
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1w" });
      res.send({ user, token });
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

const setUser = async (req, res, next) => {
  const auth = req.header("Authorization");
  console.log(auth);
  if (!auth) {
    next();
  } else {
    const [, token] = auth.split(" ");
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    console.log(user);
  }
  next();
};

// To allow the post request to work set authRequired to false in the config object and comment out the first piece of middleware
app.post("/cupcakes", setUser, async (req, res, next) => {
  console.log(req.user);
  try {
    if (!req.user) {
      return next();
    } else {
      const createdCupcake = await Cupcake.create({
        title: req.body.title,
        flavor: req.body.flavor,
        stars: req.body.stars,
        userId: req.user.id,
      });
      res.send(createdCupcake);
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// error handling middleware
app.use((error, req, res, next) => {
  console.error("SERVER ERROR: ", error);
  if (res.statusCode < 400) res.status(500);
  res.send({ error: error.message, name: error.name, message: error.message });
});

app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});
