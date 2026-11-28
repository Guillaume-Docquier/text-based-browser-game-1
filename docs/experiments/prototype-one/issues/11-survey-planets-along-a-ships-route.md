# Heirs of Sol Prototype 1 · 11/26 · Survey planets along a ship’s route

Agent: Codex gpt-6.2-astra high

## Description

A scouting trip should be useful even when the transport passes a promising planet between turn endpoints. Suppose a ship starts outside scan range, passes close to the planet, and finishes beyond it. The player should be able to inspect the planet’s updated observation afterward and decide whether to send a colony ship back. Passing traffic and loose resources leave no observation to consult later.

## Implementation order

11 of 26

## Direct dependencies

[ticket 09](09-move-a-ship-between-bodies.md), [ticket 10](10-apply-fog-of-war-at-current-positions.md)

## Acceptance criteria

- For each turn of travel, survey planets whose shortest distance to the segment traveled is 1.5 light-years (LY) or less. Use this radius for scouts, transports, and colony ships. An empty scout can survey a longer segment in one turn because it travels faster. Take the segment from the actual movement resolved for that ship and its current load.
- A planet passed within range receives an observation of its resolved attributes even if the ship finishes the turn outside scan range. The player can inspect that observation afterward.
- The path leaves no memory of other ships, cargo, or stockpile contents. Only entities in final current vision are visible, subject to the Sun’s public visibility rule.
