import express from "express"
import cors from "cors"
import { parseEnv } from "./parseEnv.ts"

const env = parseEnv()

const app = express()
app.use(cors({ origin: env.FRONTEND_HOST }))

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

const port = env.API_PORT
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
