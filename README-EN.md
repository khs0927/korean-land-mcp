# Korean Land MCP — v2.0 (English)

An MCP server that answers "which zoning / overlays / designations apply to this Korean parcel?" using the **V-World Open API** (Ministry of Land, Infrastructure and Transport). It covers what a person would normally check by hand on 토지이음 (eum.go.kr). Pair it with **korean-law-mcp** for the legal text.

## Principles
1. **V-World only.** No scraping, no other commercial APIs, no mock data. The mock fallback from v1 was removed.
2. **Honest failure.** Layer errors are surfaced in `layer_errors` and never filled with fake data.
3. **Spatial only.** This server tells you *where* a parcel sits. Interpreting the law is korean-law-mcp's job.
4. **Priority delegation hint.** It flags designations that trigger 국토계획법 Art. 76(5), where another statute's restrictions take precedence.

## Tools (8)
| Tool | Description |
|---|---|
| `resolve_parcel` | Address / jibun / 19-digit PNU → PNU, 지목, official land price, admin hierarchy, WGS84 point |
| `get_parcel_boundary` | **New.** Cadastral parcel polygon (GeoJSON, EPSG:4326) from `LP_PA_CBND_BUBUN`, plus bbox, vertex count and approximate area in m² (not the official 토지대장 area) |
| `get_zoning` | 용도지역 / 용도지구 / 용도구역 and land-transaction permit zones |
| `get_district_plan` | 지구단위계획구역 and development-permit restriction areas |
| `get_urban_facility` | Urban planning facilities (9 categories); `radius_m` separates overlap from nearby |
| `get_other_law_designations` | About 40 designation layers under other statutes, with Art. 76(5) hints |
| `get_land_attributes` | 지목 parsing, land price, building presence |
| `analyze_parcel` | Runs all of the above in parallel and returns next-step hints for korean-law-mcp |

`discover_tools` lists the tools wired into the current build.

## Setup
```bash
git clone https://github.com/khs0927/korean-land-mcp.git
cd korean-land-mcp
npm run setup        # install → build → interactive configure (writes .env)
```
Get a free key at https://www.vworld.kr/dev/v4api.do. Register the domain `localhost` for local use.

Required environment variables: `VWORLD_API_KEY` and `VWORLD_DOMAIN`, which must match the domain the key is bound to. Optional: `VWORLD_CACHE_TTL_SEC` (default 600) and `VWORLD_CACHE_MAX` (default 2000).

### Claude Desktop / Claude Code
```json
{
  "mcpServers": {
    "korean-land": {
      "command": "node",
      "args": ["/absolute/path/to/korean-land-mcp/dist/server.js"],
      "env": { "VWORLD_API_KEY": "<your key>", "VWORLD_DOMAIN": "localhost" }
    }
  }
}
```

## Tests
```bash
npm test            # offline unit tests (V-World responses mocked from tests/fixtures)
```
Live tests are in `tests/live/` and need a real key.

## Limitations
- Overlay tools query at the parcel's representative point. When the result matters, intersect it with `get_parcel_boundary` to confirm coverage of the whole parcel.
- Area is not available from V-World. `approx_area_m2` is a geometric estimate.
- Results are reference information, not a legal 토지이용계획확인서.

## License
MIT. This is a fork of UrbanWatcherKr/korean-land-mcp.
