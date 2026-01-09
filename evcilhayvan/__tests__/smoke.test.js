import path from "path";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

let app;
let mongo;
let User;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

async function createVerifiedUser(email, name) {
  await request(app)
    .post("/api/auth/register")
    .send({ name, email, password: "password123" })
    .expect(201);

  const userDoc = await User.findOne({ email }).select("+verificationToken");
  const verifyRes = await request(app)
    .post("/api/auth/verify-email")
    .send({ email, code: userDoc.verificationToken })
    .expect(200);

  return {
    id: verifyRes.body.user.id,
    token: verifyRes.body.token,
    refreshToken: verifyRes.body.refreshToken,
  };
}

describe("API smoke flows", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET = "test-secret";
    process.env.UPLOAD_DIR = path.join(process.cwd(), "uploads-test");
    process.env.NODE_ENV = "test";

    ({ app } = await import("../server.js"));
    ({ default: User } = await import("../src/models/User.js"));

    await mongoose.connect(process.env.MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
  });

  it("covers auth, advert, messaging, and store flows", async () => {
    const userAEmail = `userA-${Date.now()}@test.com`;
    const userBEmail = `userB-${Date.now()}@test.com`;

    const userA = await createVerifiedUser(userAEmail, "User A");
    const userB = await createVerifiedUser(userBEmail, "User B");

    const refreshRes = await request(app).post("/api/auth/refresh").send({ refreshToken: userA.refreshToken }).expect(200);
    expect(refreshRes.body.token).toBeTruthy();

    const petRes = await request(app)
      .post("/api/pets")
      .set(authHeader(userA.token))
      .send({
        name: "Mars",
        species: "dog",
        gender: "male",
        ageMonths: 12,
        vaccinated: true,
        advertType: "adoption",
      })
      .expect(201);
    const petId = petRes.body.pet.id;

    await request(app).get("/api/pets").expect(200);
    await request(app).get(`/api/pets/${petId}`).expect(200);
    await request(app)
      .put(`/api/pets/${petId}`)
      .set(authHeader(userA.token))
      .send({ name: "Mars-updated", species: "dog", gender: "male", ageMonths: 13, vaccinated: true })
      .expect(200);

    const convoRes = await request(app)
      .post("/api/conversations")
      .set(authHeader(userA.token))
      .send({ participantId: userB.id })
      .expect(200);
    const conversationId = convoRes.body.conversation.id;

    const messageRes = await request(app)
      .post(`/api/conversations/${conversationId}`)
      .set(authHeader(userA.token))
      .send({ text: "hello" })
      .expect(201);
    const messageId = messageRes.body.message.id;

    await request(app)
      .patch(`/api/conversations/message/${messageId}/for-me`)
      .set(authHeader(userA.token))
      .expect(200);

    const storeRes = await request(app)
      .post("/api/stores/create")
      .set(authHeader(userB.token))
      .send({ storeName: "Test Store" })
      .expect(201);
    const sellerToken = storeRes.body.token;

    const productRes = await request(app)
      .post("/api/stores/me/products")
      .set(authHeader(sellerToken))
      .send({ title: "Kopek Maması", price: 99.9, stock: 3 })
      .expect(201);
    const productId = productRes.body.product.id;

    await request(app)
      .patch(`/api/seller/products/${productId}`)
      .set(authHeader(sellerToken))
      .send({ price: 109.9 })
      .expect(200);

    await request(app).get("/api/store/products").expect(200);

    await request(app)
      .post("/api/store/cart/add")
      .set(authHeader(userA.token))
      .send({ productId, quantity: 2 })
      .expect(201);

    await request(app).delete(`/api/pets/${petId}`).set(authHeader(userA.token)).expect(200);
  });
});
