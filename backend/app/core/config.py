from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "ihm_purchase"
    DATABASE_URL: str | None = None

    SMARTPAL_EMAIL: str = ""
    SMARTPAL_PASSWORD: str = ""
    SMARTPAL_BASE_URL: str = "https://smartpal.ozellar.com/Home/Account/Index"

    SCRAPER_CRON_HOUR: int = 2
    SCRAPER_CRON_MINUTE: int = 0

    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
