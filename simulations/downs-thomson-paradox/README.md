# Downs-Thomson City Lab

A dependency-free browser traffic microsimulation for exploring the Downs-Thomson paradox. One hundred persistent commuters choose between driving and transit inside a larger simulated city. Driving time is produced by individual vehicles moving through lanes, signals, queues, alternate roads, background traffic, a mountain route, and an optional tunnel.

- [Open the released simulation](https://bortlip.github.io/SharedInfo/simulations/downs-thomson-paradox/)

## What changed from the simple model

There is no `base + congestion * drivers` travel-time curve. Road links have modeled distance and speed that are independent of their drawing size. Each driving commuter becomes a microscopic vehicle with a lane, position, speed, following headway, departure time, and measured arrival time.

The surrounding city also creates hundreds of ambient vehicle trips each morning. Those vehicles are generated from multiple origins and destinations and route through a bidirectional graph containing:

- a west-east urban arterial;
- north/south side streets and four signalized arterial intersections;
- local roads north of the mountain;
- a parallel southern surface route;
- the old mountain highway;
- downtown streets;
- and, after construction, the direct mountain tunnel.

Ambient traffic can reroute when the tunnel opens, so the tracked 100 commuters are not the only vehicles responding to the new road.

## Traffic signals

Signals no longer allow one symbolic car per direction. They model fixed-time phases using:

- configurable cycle length (default 90 seconds);
- configurable main-street green split (default 57%);
- yellow and all-red clearance intervals;
- about two seconds of startup lost time for a standing queue;
- configurable saturation flow (default 1,900 vehicles/hour/lane);
- independent lane queues and discharge clocks;
- and optional coordinated offsets intended to create a rough eastbound green wave.

Once a queue begins discharging on green, multiple vehicles can pass during that phase at the configured saturation headway.

## Lanes and car following

The default city uses a constrained one-lane-per-direction urban arterial feeding a two-lane-per-direction tunnel. Both are adjustable. Cars maintain a standstill spacing and a moving time headway, accelerate/decelerate toward road speed, stop at red lights, wait for downstream lane space, and can create queues that spill backward onto upstream links.

The displayed driving average is simply the mean of each tracked driver's arrival time minus departure time. Red-light delay and traffic/queue delay are also accumulated separately for each driver.

## Transit

Transit riders are individual commuters with their own departure and station-arrival times. They walk to the station, catch the next scheduled train, ride downtown, and walk to their destination.

The default city is calibrated around a pre-tunnel population near 40 drivers / 60 transit riders. Transit maintains its base 3.6-minute headway while at least 60 tracked commuters ride. Below that service-support level, its headway increases according to the configurable **Transit headway penalty**. This is the Downs-Thomson feedback: a road improvement can pull enough riders away that the competing transit service becomes less attractive.

## Mode adaptation

After each morning, tracked commuters compare the observed mean driving and transit times. A small number of people whose current mode is sufficiently slower than the alternative switch for the following morning, subject to an individual switching reluctance and a short cooldown. Repeated mornings therefore approach a mode-choice equilibrium without algebraically imposing one.

A useful experiment is:

1. Run the old city until the mode split is stable.
2. Build the tunnel without changing anybody's commute mode first.
3. Observe the immediate physical road improvement.
4. Run repeated mornings until commuters and traffic settle again.
5. Compare the stable pre- and post-tunnel commute times.
6. Change background traffic, arterial lanes, tunnel lanes/speed, signal timing, saturation flow, signal coordination, or transit feedback and see when the paradox appears or disappears.

## Remaining simplifications

This is deliberately a teaching microsimulation, not a calibrated transportation forecast. Important remaining simplifications include no pedestrians/bicycles, parking maneuvers, crashes, detailed lane-changing behavior, buses in mixed traffic, protected/permissive left-turn phases, actuated signal detection, or explicit intersection conflict geometry. Turning vehicles use the phase of their incoming approach, and route choice currently uses shortest expected free-flow network cost rather than learned congested travel times.

Those omissions are now explicit rather than hidden inside a congestion formula, and they provide natural directions for further iterations if they improve the lesson rather than merely adding machinery.
