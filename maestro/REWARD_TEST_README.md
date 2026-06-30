# Maestro E2E Tests — Reward System

## Setup Maestro CLI

```bash
# Linux (via Homebrew)
brew install mobile-dev-inc/formulae/maestro

# Or download manual
curl -Ls https://get.maestro.dev | bash
```

## Run Tests

```bash
maestro test maestro/flows/
```

## Test Cases

| TC | File | Description |
|----|------|-------------|
| TC1 | 01_home_reward_display | StreakBadge, navigation |
| TC2 | 02_earn_rewards | Read book -> quiz -> celebrate |
| TC3 | 03_reward_balance_update | Coin balance on games screen |
| TC4 | 04_reward_redemption | Games screen redemption flow |
| TC5 | 05_reward_profile_display | Parent screen reward display |

## Notes
- Element locators use text/label (black-box)
- ensure_logged_in.yaml handles login flow
- Backend must be running on port 8123
