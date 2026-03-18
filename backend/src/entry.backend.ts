import express from "express"

const app = express()
const port = 3000

let tick = 0

app.get("/tick", (req, res) => {
  res.send({ tick })
})

app.post("/tick", (req, res) => {
  tick++
  res.send({ tick })
})

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
