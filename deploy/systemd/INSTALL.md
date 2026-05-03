# systemd installation

These unit files run ChatHermes as a long-lived service that auto-restarts on
failure and survives reboots. Use them for any production deployment.

## Prerequisites

- ChatHermes cloned to `/opt/chathermes` (or change `WorkingDirectory` paths)
- Bun installed at `/usr/local/bin/bun` (or change `ExecStart` paths)
- A dedicated `chathermes` system user

## Setup

```bash
# 1. Create user + log dir
sudo useradd --system --home-dir /opt/chathermes --shell /bin/false chathermes
sudo mkdir -p /var/log/chathermes
sudo chown chathermes:chathermes /var/log/chathermes /opt/chathermes -R

# 2. Run the install wizard as that user
sudo -u chathermes /opt/chathermes/bin/install.sh

# 3. Copy unit files
sudo cp /opt/chathermes/deploy/systemd/*.service /etc/systemd/system/
sudo cp /opt/chathermes/deploy/systemd/chathermes.target /etc/systemd/system/

# 4. Reload + enable
sudo systemctl daemon-reload
sudo systemctl enable --now chathermes.target

# 5. Check
sudo systemctl status chathermes-orch chathermes-proxy chathermes-web
```

## Operations

```bash
# Tail logs
sudo journalctl -u chathermes-orch -f
sudo tail -f /var/log/chathermes/orch.log

# Restart everything
sudo systemctl restart chathermes.target

# Stop everything
sudo systemctl stop chathermes.target

# Disable auto-start
sudo systemctl disable chathermes.target
```

## Custom ports

Edit the `Environment=PORT=...` lines in each `.service` file, then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart chathermes.target
```

## Behind nginx + HTTPS

See the main `INSTALL.md` for the nginx reverse-proxy snippet and certbot setup.
