# Using RediSearch and RedisJSON to provide powerful search over Bigfoot sightings.
Explore Bigfoot sightings within the demonstrative **NodeJS** application. Find relative data with the ability to search for sightings reported at specific state and/or county, containing specific word(s) and/or withing specific distance radius from the base point.

Home page contains the following **3** plots.
- map showing reported Bigfoot sightings based on a query, with short hover information
- plot showing Bigfoot sightings based on a query, grouped by season
- plot showing Bigfoot sightings based on a query, grouped by year

<p align="center">
  <img src="screenshots/sightings-overview.png" width="650" alt="Sightings Overview">
</p>

On hover, each Bigfoot sighting shows short summarized description with **highlighted** queried data.

<p align="center">
  <img src="screenshots/sightings-search.png" width="650" alt="Sightings Search">
</p>

On click, you're able to get complete details regarding specific Bigfoot sighting.

<p align="center">
  <img src="screenshots/sighting-info.png" width="650" alt="Sighting Informations">
</p>

# Running with Docker Compose

```bash
$ docker --version
Docker version 20.10.12, build e91ed57
```

Set appropriate environment variables or use the variables within the given example. See [section](#environment) regarding environment variables.

```bash
$ cp .env.example .env
```
Once you have **.env** set, build and start application with following *Docker Compose* commands.

```bash
$ docker-compose build
$ docker-compose up --force-recreate
...
Friday, 01 Apr 2022 19:51:55 GMT redis-bigfoot-sightings:server server listening on port 80
...
```
# Pages

## sightings
Page showing the overview of the Bigfoot sightings, with the ability to query for specific sighting(s).

## sighting
Page showing complete details for the specific Bigfoot sighting, including county, state, location coordinates, location details, date of the actual report, season and classification details, as well as title and description.

# Environment
| Variable          | Default                           | Description |
| -----------       | -----------                       | ----------- |
| SERVER_HOST       | http://localhost                  | host on which applicatin will be running |
| SERVER_PORT       | 80                                | port on which applicatin will be running |
| DEBUG             | redis-bigfoot-sightings:server    | defines debug logging |
| REDIS_HOST        | redis                             | host on which *Redis* server is running |
| REDIS_PORT        | 6379                              | port on which *Redis* server is running |
| REDIS_USER        | default                           | user used to connect to *Redis* server |
| REDIS_PASSWORD    |                                   | password used to connect to *Redis* server |
| REDIS_DB_ALIAS    | 0                                 | database alias to connect to |


# Data
Application is using Bigfoot sightings data, which contains sighing data publicly available on the [*BFRO*](https://www.bfro.net/) website in a more digestible form.

The **geocoded** version has been used since the application itself offers geospatial search as well. Bigfoot sightings data can be found and downloaded [here](https://data.world/timothyrenner/bfro-sightings-data/workspace/file?filename=bfro_reports_geocoded.csv).