# Downs-Thomson Paradox

A one-page interactive toy model showing how a highway improvement can make equilibrium commute times worse when driving competes with public transit that benefits from ridership.

- [Open the released simulation](https://bortlip.github.io/SharedInfo/simulations/downs-thomson-paradox/)

## Default story

There are 100 commuters choosing between driving and public transit.

- Before the tunnel, driving takes `25 + 0.50D` minutes, where `D` is the number of drivers. The 25-minute free-flow term includes a 5-minute detour around the mountain.
- After the tunnel opens, driving takes `20 + 0.50D` minutes.
- Transit takes `35 + 0.25D` minutes. As more people leave transit for cars, the toy model treats service as becoming less frequent/convenient, so transit time rises.

Using the standard nonatomic/Wardrop form of a Nash mode-choice equilibrium, commuters keep switching to the faster mode until both used modes have the same travel time.

- Before: `D = 40`, so driving and transit both take 45 minutes.
- Immediately after the tunnel opens, the same 40 drivers take 40 minutes while transit still takes 45, so transit riders have an incentive to switch.
- After adaptation: `D = 60`, and both modes take 50 minutes.

The five-minute road improvement therefore produces a new equilibrium that is five minutes worse for everyone. The mechanism is the Downs-Thomson paradox: road improvement can pull enough riders from transit to weaken the competing transit service, while the additional cars also rebuild road congestion.

This is deliberately a transparent teaching model, not a calibrated transportation forecast. The 100 commuter dots are discrete for visualization, while the equilibrium concept is the usual nonatomic/Wardrop approximation in which one commuter is too small to change the cost functions by themselves.
