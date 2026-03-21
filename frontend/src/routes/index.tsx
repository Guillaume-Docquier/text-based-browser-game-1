import { type ReactElement } from "react"
import reactLogo from "../assets/react.svg"
import viteLogo from "../assets/vite.svg"
import heroImg from "../assets/hero.png"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index(): ReactElement {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()

  const tick = useQuery({
    queryKey: ["tick"],
    queryFn: async () => await backendApiClient.getTick(),
  })

  const incrementTick = useMutation({
    mutationFn: async () => {
      await backendApiClient.incrementTick()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tick"] })
    },
  })

  const hue = (((tick.data ?? 0) % 10000) / 10000) * 360

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Cosmic Empires</h1>
          <p>A deep text based strategy game where diplomacy is an option</p>
        </div>
        <button
          className="counter"
          style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
          onClick={() => {
            incrementTick.mutate()
          }}
        >
          Game tick is {tick.data ?? "unknown"}
        </button>
        <Link to="/about">Explore</Link>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noreferrer">
                <img className="logo" src={viteLogo} alt="" />
                Explore Cosmic Empires
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank" rel="noreferrer">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Cosmic Empires community</p>
          <ul>
            <li>
              <a href="https://github.com/Guillaume-Docquier/text-based-browser-game-1" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}
