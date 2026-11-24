# Turn Processing tests

Use the API test harness to create the game and observe the result. For example, start a game through the client, advance a controlled clock until a Turn is due, call the worker's production entry point, and read the new Turn through the client.

For worker setup only, use a production controller or repository when the API cannot establish a required precondition. Use the API for every setup step it supports. Keep this exception local to Turn Processing and keep test-only operations out of the public API.
