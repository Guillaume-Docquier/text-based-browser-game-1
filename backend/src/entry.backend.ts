import express from "express"
import cors from "cors"

const app = express()
app.use(cors({ origin: "http://localhost:5173" }))

let tick = 0

app.get("/tick", (req, res) => {
  res.send({ tick })
})

app.post("/tick", (req, res) => {
  tick++
  res.send({ tick })
})

const port = 3000
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
