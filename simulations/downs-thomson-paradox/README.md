# Downs-Thomson Street Lab

A dependency-free browser traffic microsimulation of the Downs-Thomson paradox. One hundred persistent commuters choose between driving and transit. Driving happens on an actual small street network with side roads, three signalized intersections, background cross traffic, individual cars, car following, queues, spillback, a mountain bypass, and a tunnel. Transit riders catch scheduled trains whose service frequency responds to ridership.

- [Open the released simulation](https://bortlip.github.io/SharedInfo/simulations/downs-thomson-paradox/)

## What is simulated

### Persistent commuters

There are 100 people with deterministic home locations, departure times, driving pace, current travel mode, and individual reluctance to switch modes. The calibrated default begins at 13 drivers and 87 transit riders, close to the old-network equilibrium produced by the street and timetable models.

After each morning, commuters compare the observed average driving and transit times. At most three sufficiently dissatisfied commuters change modes for the following morning. Stable means nobody currently has enough incentive to switch; the equilibrium is discovered by repeated agent decisions rather than imposed algebraically.

### Street network and cars

There is no congestion travel-time equation. Every driver creates an individual vehicle on a directed road graph.

Cars:

- leave from one of several suburban approaches at their commuter's departure time;
- accelerate toward each street's free-flow speed;
- maintain a minimum following gap;
- stop at red traffic lights;
- wait when the next road segment has no room;
- can form queues that propagate backward through the network;
- share signal green time with independent north/south background traffic;
- travel around the mountain before the tunnel and through it afterward.

The old route and tunnel speeds are calibrated so the tunnel removes about five minutes of free-flow driving time. Actual commute time is simply each car's measured arrival time minus its departure time.

### Traffic lights and cross traffic

Three intersections on the commuter corridor have offset two-phase traffic signals. Side-street vehicles are generated independently in both directions and physically traverse those intersections. They do not count among the 100 commuters, but they consume green time and contribute to queues and spillback.

The page exposes controls for cross-traffic intensity and signal-cycle length, so the paradox can be explored under different traffic conditions rather than only under one scripted congestion curve.

### Transit

Each transit commuter walks from home to the suburban station, arrives at an individual time, waits for the next scheduled train, rides downtown, and walks to the final destination. Train headway is set once per morning from current ridership. Losing riders stretches the timetable, which is the competing-mode feedback required for the Downs-Thomson mechanism.

## Default demonstration

With deterministic default parameters:

1. The old city begins near equilibrium at 13 drivers / 87 transit riders, with both modes around 35.5 minutes.
2. Opening the tunnel changes only the street graph at first. With the same mode choices, driving drops by roughly five minutes.
3. Transit riders then begin switching to the faster road over repeated mornings.
4. Extra commuter cars interact with cross traffic and signals, increasing queues and stopped time, while lower transit ridership stretches train headways.
5. The system typically settles near 27 drivers / 73 transit riders, with both modes around 37.5 minutes in the calibrated deterministic run: roughly two minutes worse than before the road improvement.

Those values are outputs of the simulated vehicles, traffic lights, timetable, and mode-changing agents. Changing cross traffic or signal timing can move the equilibrium or eliminate the paradox entirely.

This remains a teaching model, not a calibrated transportation forecast. Its purpose is to expose the causal machinery instead of hiding it inside a travel-time formula.
