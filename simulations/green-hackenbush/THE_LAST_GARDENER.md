# The Last Gardener: a complete Sprague–Grundy solution

*The puzzle is presented first without spoilers. A clearly marked boundary separates it from the complete solution and deeper theory appendix.*

## 1. The puzzle

The garden contains four grounded arrangements of green segments—called shrubs here—and a bowl holding \(n\) pebbles.

Two players alternate turns. On a turn, a player must make exactly one move:

1. **Cut one green segment.** Any segments that are no longer connected to the ground immediately fall away.
2. **Remove one or more pebbles** from the bowl.

The player who makes the last legal move wins. The puzzle asks for the unique value \(n\in\{0,\ldots,63\}\) that makes the complete starting position a second-player win. It also asks which shrub is “decorative,” meaning that it contributes Grundy value \(0\).

This is a finite, impartial, normal-play game:

- **Finite:** every move permanently removes at least one segment or pebble.
- **Impartial:** both players have the same available moves from any position.
- **Normal play:** the player making the final move wins.

Those three properties are exactly the setting in which Sprague–Grundy theory applies.

> **Try it before reading on.** Find the unique value of \(n\) and identify the decorative shrub. The [interactive simulator](simulator.html) lets you experiment with the supplied position without showing the walkthrough first.

---

> **⚠️ Spoiler warning.** Everything below explains the solving method and eventually reveals both requested answers. Stop here if you want to work the puzzle out yourself.

---

## 2. Turn the picture into independent games

Each shrub is an undirected graph. The ground is represented by a special vertex \(G\). A green segment is an edge.

The four shrubs can be encoded as follows:

```text
Oak:    G-A, A-B, B-C, A-D
Arch:   G-A, A-B, B-G
Window: G-A, A-B, B-C, C-G
Tower:  G-A, A-B, B-G, B-C, C-D
```

The bowl is an ordinary Nim heap of size \(n\), because one move removes any positive number of pebbles.

Although every shrub touches the same physical ground, a cut in one shrub never changes another shrub. The shrubs and the bowl are therefore **independent components** of one larger game. On each turn, a player chooses exactly one component and moves only in that component.

Sprague–Grundy theory tells us to:

1. assign a Grundy value to each component;
2. combine those values using bitwise XOR;
3. classify total XOR \(0\) as losing for the player to move and nonzero XOR as winning.

## 3. Grundy values and mex

For any position \(P\), let its legal options be the positions reachable in one move. Its Grundy value is

\[
g(P)=\operatorname{mex}\{g(Q):Q\text{ is reachable from }P\},
\]

where **mex** means “minimum excluded nonnegative integer.”

Examples:

- \(\operatorname{mex}\{1,2,3\}=0\)
- \(\operatorname{mex}\{0,2,3\}=1\)
- \(\operatorname{mex}\{0,1,3\}=2\)
- \(\operatorname{mex}\{0,1,2\}=3\)

A position with no legal moves has option set \(\varnothing\), so its value is

\[
\operatorname{mex}(\varnothing)=0.
\]

The important subtlety is that a nonterminal position can also have value \(0\). It merely needs all of its moves to lead to nonzero values.

## 4. Evaluate the Oak

The Oak has edges

```text
G-A, A-B, B-C, A-D
```

Its four possible first cuts reach positions with Grundy values \(0,2,1,3\).

| Cut | What remains after unsupported pieces fall | Reachable value |
|---|---|---:|
| `G-A` | Nothing; the entire shrub loses contact with the ground | 0 |
| `A-B` | The grounded two-edge arm `G-A-D` | 2 |
| `B-C` | A grounded fork with edges `G-A`, `A-B`, `A-D` | 1 |
| `A-D` | The three-edge chain `G-A-B-C` | 3 |

Therefore

\[
g(\text{Oak})=\operatorname{mex}\{0,1,2,3\}=4.
\]

So the Oak behaves, for purposes of combination with other games, exactly like a Nim heap of size \(4\).

## 5. Evaluate the Arch

The Arch is a triangle:

```text
G-A, A-B, B-G
```

Its move values are:

| Cut | Result | Reachable value |
|---|---|---:|
| `G-A` | A two-edge chain rooted through `G-B` | 2 |
| `A-B` | Two independent one-edge stalks | \(1\oplus1=0\) |
| `B-G` | A two-edge chain rooted through `G-A` | 2 |

Thus

\[
g(\text{Arch})=\operatorname{mex}\{0,2\}=1.
\]

The Arch is equivalent to a Nim heap of size \(1\).

## 6. Evaluate the Window

The Window is a four-edge cycle:

```text
G-A, A-B, B-C, C-G
```

Every possible cut breaks the cycle and leaves a position of value \(3\).

For a ground edge cut, the remainder is a three-edge chain. For an upper edge cut, the remainder separates into a one-edge stalk and a two-edge chain, whose values XOR to

\[
1\oplus2=3.
\]

Hence the complete option-value set is simply

\[
\{3\},
\]

and

\[
g(\text{Window})=\operatorname{mex}\{3\}=0.
\]

This is the decorative shrub.

“Decorative” does **not** mean irrelevant move by move. Players can cut it, and those cuts change the game. It means that the intact Window contributes \(0\) to the starting XOR, just as an empty Nim heap contributes \(0\).

## 7. Evaluate the Tower

The Tower consists of a triangular base and a two-edge tail:

```text
G-A, A-B, B-G, B-C, C-D
```

Its five first cuts have values \(4,2,4,1,0\).

| Cut | Result | Reachable value |
|---|---|---:|
| `G-A` | A rooted tree with one short arm and one two-edge arm | 4 |
| `A-B` | A one-edge stalk plus a three-edge chain | \(1\oplus3=2\) |
| `B-G` | Symmetric to cutting `G-A` | 4 |
| `B-C` | The tail falls, leaving the triangular Arch | 1 |
| `C-D` | The triangle with a one-edge tail | 0 |

Therefore

\[
g(\text{Tower})=\operatorname{mex}\{0,1,2,4\}=3.
\]

Notice that the reachable value \(3\) is absent, even though \(4\) is present. Mex cares only about the smallest missing nonnegative integer, so the value is \(3\).

## 8. Combine the four shrubs

The shrub values are

\[
4,\quad 1,\quad 0,\quad 3.
\]

Independent impartial games combine by XOR:

\[
4\oplus1\oplus0\oplus3.
\]

In binary,

```text
4 = 100
1 = 001
0 = 000
3 = 011
---------
    110 = 6
```

So the four shrubs together have Grundy value

\[
6.
\]

## 9. Add the bowl

A bowl containing \(n\) pebbles is a Nim heap of size \(n\). The total game therefore has value

\[
6\oplus n.
\]

A position is losing for the player to move exactly when its total Grundy value is \(0\). We need

\[
6\oplus n=0.
\]

For any nonnegative integer \(x\),

\[
x\oplus n=0\quad\Longleftrightarrow\quad n=x.
\]

Therefore

\[
\boxed{n=6}.
\]

The restriction \(0\le n\le63\) does not create several possibilities. It merely confirms that the required value \(6\) is allowed. The solution is unique.

## 10. Why this gives the second player the win

With six pebbles, the starting value is

\[
4\oplus1\oplus0\oplus3\oplus6=0.
\]

A zero position has two crucial properties:

1. every legal move changes it to a nonzero position;
2. from every nonzero position, there is at least one move back to zero.

So the first player must move from \(0\) to nonzero. The second player then chooses a move that restores XOR \(0\). Repeating this response strategy eventually leaves the first player with no legal move.

This is not necessarily a visual mirror strategy. The correct response may occur in a completely different shrub or in the bowl. The invariant being restored is algebraic: total XOR \(0\).

## 11. The balancing rule

The puzzle illustrates a useful general construction.

Suppose several independent components have Grundy values

\[
g_1,g_2,\ldots,g_k.
\]

Let

\[
X=g_1\oplus g_2\oplus\cdots\oplus g_k.
\]

If you add one adjustable Nim heap—or a bowl from which any positive number may be removed—then setting its size to \(X\) makes the whole position zero:

\[
X\oplus X=0.
\]

So:

> **To tune a game for a second-player win, set one adjustable bowl equal to the XOR of everything else.**

Here the shrubs XOR to \(6\), so the balancing bowl must contain \(6\) pebbles.

## 12. A compact solution

For a contest-length answer:

1. Model the shrubs as finite impartial games.
2. Compute their Grundy values by recursive mex:
   \[
   g(\text{Oak})=4,\quad
   g(\text{Arch})=1,\quad
   g(\text{Window})=0,\quad
   g(\text{Tower})=3.
   \]
3. XOR the shrubs:
   \[
   4\oplus1\oplus0\oplus3=6.
   \]
4. The bowl has value \(n\), so the whole position is \(6\oplus n\).
5. A second-player win requires total value \(0\), hence \(n=6\).
6. The zero-valued decorative shrub is the Window.

---

## Appendix A: why Sprague–Grundy theory works

## A.1 Positions as numbers called nimbers

The Sprague–Grundy theorem says that every finite impartial normal-play position is equivalent, when added to any other such game, to exactly one Nim heap.

That heap size is the position’s Grundy value, also called its **nimber**.

The theorem is stronger than saying two positions have the same winner. It says that replacing a component by its equivalent Nim heap preserves the outcome of **every larger disjunctive sum** in which the component appears.

That is why we are allowed to replace complicated shrubs by the numbers \(4,1,0,3\) and then reason only with Nim.

## A.2 The recursive definition

The recursion starts at terminal positions:

\[
g(\text{terminal})=0.
\]

For a nonterminal position \(P\),

\[
g(P)=\operatorname{mex}\{g(Q):P\to Q\}.
\]

This definition is well-founded because the game is finite. Every move strictly reduces the number of remaining edges or pebbles, so recursion eventually reaches a terminal state.

## A.3 The key mex facts

Let \(g(P)=m\). By the definition of mex:

- no option of \(P\) has value \(m\);
- for every integer \(r<m\), some option of \(P\) has value \(r\).

Those two facts are exactly what is needed to make \(P\) behave like a Nim heap of size \(m\).

## A.4 Proof sketch of equivalence to a Nim heap

Write \(*m\) for a Nim heap of size \(m\). Consider the sum \(P+*m\).

Because no option of \(P\) has value \(m\), moving in \(P\) cannot produce two equal nimbers. Moving in the heap changes \(m\) to something smaller, also making the two values unequal. Thus no move from \(P+*m\) reaches a zero XOR position.

Now consider \(P+*r\) with \(r\ne m\).

- If \(r<m\), mex guarantees that \(P\) has an option \(Q\) with \(g(Q)=r\). Moving to \(Q+*r\) gives XOR \(r\oplus r=0\).
- If \(r>m\), the Nim heap can be reduced from \(r\) to \(m\), giving \(P+*m\), whose XOR is \(m\oplus m=0\).

So \(P+*m\) is losing, while \(P+*r\) is winning for every \(r\ne m\). This characterizes \(P\) as equivalent to the Nim heap \(*m\).

The induction hypothesis is used on the smaller option positions \(Q\).

## A.5 Why Nim heaps combine by XOR

For heaps of sizes \(a_1,\ldots,a_k\), define the nim-sum

\[
S=a_1\oplus\cdots\oplus a_k.
\]

Bouton’s theorem for Nim proves:

- If \(S=0\), every move makes \(S\ne0\).
- If \(S\ne0\), there is a move that makes \(S=0\).

To find that move, inspect the highest binary bit set in \(S\). At least one heap has that bit set. Reducing a suitable such heap to

\[
a_i'=a_i\oplus S
\]

makes the total XOR zero, and the chosen highest-bit property guarantees \(a_i'<a_i\), so the move is legal.

Sprague–Grundy theory imports this XOR rule from Nim to all finite impartial normal-play games.

---

## Appendix B: computing shrub values mechanically

## B.1 A shrub state

A shrub state can be represented by the set of edges still present.

To evaluate one legal cut:

1. remove the chosen edge;
2. run a graph search starting at ground vertex \(G\);
3. discard every remaining edge whose endpoints are not in the ground-connected component;
4. recursively evaluate the resulting canonical edge set.

The Grundy value is the mex of all recursively obtained values.

## B.2 Pseudocode

```text
grundy(state):
    if state is cached:
        return cache[state]

    option_values = empty set

    for each edge e in state:
        next = state with e removed
        next = keep only edges connected to ground G
        option_values.add(grundy(next))

    result = mex(option_values)
    cache[state] = result
    return result
```

Memoization matters because many different sequences of cuts reach the same surviving edge set.

## B.3 Why the solver grows quickly

A shrub with \(E\) edges has at most \(2^E\) raw edge subsets. Ground-connectivity pruning eliminates many subsets, but the worst-case growth is still exponential.

That is why a browser simulator can solve modest shrubs exactly but should impose a practical edge cap for randomly generated games.

## B.4 Multiple ground connections

The ground can be represented as one symbolic vertex \(G\), even when the drawing shows several separate vertical contacts with the soil.

That shared symbolic ground does not create an extra playable edge between shrubs. It simply means that all grounded endpoints are supported. Two shrubs remain independent when there is no green segment joining them above the ground.

---

## Appendix C: common traps

## C.1 Counting segments is not enough

Two shrubs with the same number of edges can have different Grundy values. Cycles, branches, and multiple ground contacts change which pieces fall after a cut and therefore change the option structure.

Grundy values measure the recursive game tree, not physical size.

## C.2 A zero-valued component is not necessarily empty

The Window has four legal moves but value \(0\). Every one of its moves leads to value \(3\), so \(0\) is the smallest excluded option value.

## C.3 Ordinary addition is wrong

The component values do not add as integers:

\[
4+1+0+3=8
\]

is irrelevant. The correct operation is XOR:

\[
4\oplus1\oplus0\oplus3=6.
\]

## C.4 The perfect reply need not be in the same component

After an opponent moves in one shrub, the move restoring XOR \(0\) may be in another shrub or in the bowl. Sprague–Grundy play is a global balancing strategy.

## C.5 The bowl is special because every smaller size is reachable

A heap of \(n\) pebbles has options \(0,1,\ldots,n-1\). Therefore

\[
g(\text{heap of }n)=\operatorname{mex}\{0,1,\ldots,n-1\}=n.
\]

That direct identity is what makes the bowl an ideal tuning control.

---

## Final result

\[
\boxed{n=6}
\]

and the decorative zero-valued shrub is

\[
\boxed{\text{Window}}.
\]

The complete starting XOR is

\[
4\oplus1\oplus0\oplus3\oplus6=0,
\]

so perfect play favors the second player.
