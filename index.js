import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect(() => {
  db = mongoClient.db('uol_db');
});
const participantsSchema = joi.object({
  name: joi.string().required(),
});

app.get("/participants", (req, res) => {
  const promise = db.collection("participants").find({}).toArray();
  promise.then((participants) => res.send(participants));
  promise.catch((e) => res.sendStatus(500));
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
  try{
    await db.collection("participants").insertOne({"name":req.body.name, lastStatus:Date.now()});
    res.sendStatus(201);
    return
  }catch (error){
    res.sendStatus(500);
    return
  }
});

app.listen(5000);
