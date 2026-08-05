package main

import (
	"log"
	"os"
	"strconv"

	"github.com/pocketbase/pocketbase"
	"github.com/s-petr/longhabit/frpc"
)

// application holds the core application state and configuration.
type application struct {
	pb     *pocketbase.PocketBase
	config appConfig
	frpc   *frpc.Manager
}

// appConfig holds the application's configuration settings.
type appConfig struct {
	dbDir              string
	mailerCronSchedule string
	mailerNumWorkers   int
}

// newApplication creates and initializes a new application instance.
func newApplication() *application {
	dbDir := getEnvOrDefault("DB_DIR", "db")

	numWorkers, err := strconv.Atoi(getEnvOrDefault("MAILER_NUM_WORKERS", "10"))
	if err != nil {
		numWorkers = 10
	}

	return &application{
		pb: pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: dbDir}),
		config: appConfig{
			dbDir:              dbDir,
			mailerCronSchedule: getEnvOrDefault("MAILER_CRON_SCHEDULE", "0 9 * * *"),
			mailerNumWorkers:   numWorkers,
		},
	}
}

func main() {
	app := newApplication()

	app.mountFs()
	app.loadAuthEmailTemplates()
	app.setupAuthHooks()
	app.disableHealthRouteLogging()
	app.startNotifier()

	app.frpc = frpc.NewManager(app.pb)
	app.setupFrpc()

	log.Fatal(app.pb.Start())
}

// getEnvOrDefault retrieves the value of an environment variable by key.
// If the environment variable is empty or not set, it returns the defaultValue.
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
