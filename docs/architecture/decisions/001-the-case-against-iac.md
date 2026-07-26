# The Case Against Infrastructure As Code (IaC)

## Status

Accepted

## Context

Railway offer [Config as Code](https://docs.railway.com/config-as-code), but it only covers individual services, and only build & deploy options.

It doesn't cover environment variables or networking, for example.

You can also not define your whole project.

There is a [community Terraform provider](https://registry.terraform.io/providers/terraform-community-providers/railway/latest/docs) available, and the Railway team seemed [open to help](https://station.railway.com/feedback/terraform-provider-954567d7) the community, but otherwise there isn't real IaC support in Railway for a project.

The Railway team seems really against IaC.

> [Not using IaC in big orgs] fares very well. The only people who want Config as Code (CaC) are the people who like CaC to begin with, haha.

## Decision

Since the project is still small, we'll go with pure Railway for now. As it grows, we can consider giving Terraform a try, but for now we'll embrace the Railway way.

## Consequences

The infra is manual in the web UI. If we mess it up, it'll be hard to go back to a previous working state.

It's also hard to get a good view of the setting we care about. The UI presents all the options, not just those you changed.
