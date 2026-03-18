import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config() // load .env

const app = express()
app.use(cors({ origin: `${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}` }))

let tick = 0

app.get("/tick", (req, res) => {
  console.log("GET tick", { tick })
  res.send({ tick })
})

app.post("/tick", (req, res) => {
  tick++
  console.log("POST tick", { tick })
  res.send({ tick })
})

const port = process.env.API_PORT
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
