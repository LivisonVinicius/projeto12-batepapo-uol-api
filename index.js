import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect(() => {
  db = mongoClient.db("uol_db");
});
const participantsSchema = joi.object({
  name: joi.string().required(),
});
const messagesSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    res.send(participants);
    return;
  } catch (error) {
    res.sendStatus(500);
    return;
  }
});

app.post("/participants", async (req, res) => {
  const validation = participantsSchema.validate(req.body, {
    abortEarly: true,
  });
  const existingUser = await db
    .collection("participants")
    .findOne({ name: req.body.name });

  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  if (existingUser) {
    res.sendStatus(409);
    return;
  }
  try {
    await db
      .collection("participants")
      .insertOne({ name: req.body.name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: req.body.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
    return;
  } catch (error) {
    res.sendStatus(500);
    return;
  }
});

app.post("/messages", async (req, res) => {
  const user = req.headers.user;
  const validation = messagesSchema.validate(req.body, {
    abortEarly: true,
  });
  const existingUser = await db
    .collection("participants")
    .findOne({ name: req.body.name });
  if (validation.error || existingUser) {
    res.sendStatus(422);
    return;
  }
  try {
    await db.collection("messages").insertOne({
      from: user,
      to: req.body.to,
      text: req.body.text,
      type: req.body.type,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
    return;
  } catch (error) {
    res.sendStatus(500);
    return;
  }
});

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const limit = parseInt(req.query.limit);
  try {
    const messages = await db.collection("messages").find({$or:[{to:user}, { to:"Todos"} , {from:user} , {type:"message"}]}).toArray();
    
    if (limit === NaN) {
      res.send(messages);
      return;
    }
    const showMessages = await messages.splice(-{ limit });
    res.send(showMessages);
    return;
  } catch (error) {
    res.sendStatus(500);
    return;
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    const existingUser = await db.collection("participants").findOne({name: user });
    if (!existingUser) {
      res.sendStatus(404);
      return;
    }
    await db.collection('participants').updateOne(
      {
        name: user
      },
      {
        $set:{lastStatus:Date.now()}
      }
    )
    res.sendStatus(200);
    return
  }catch (error) {
    res.sendStatus(500);
    return;
  }
});

setInterval(async () => {
  const now = Date.now();
  const deleted = await db
    .collection("participants")
    .find({ lastStatus: { $lt: now - 10000 } })
    .toArray();
  if (deleted.length > 0) {
    await db.collection("messages").insertMany(
      deleted.map((user) => ({
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs(now).format("HH:mm:ss"),
      }))
    );
    await db.collection("participants").deleteMany({ lastStatus: { $lt: now - 10000 } });
  }
}, 15000);

app.listen(5000);
