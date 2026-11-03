I want to add our second variant, Klondike, to this game. The 1 card pull variant.

For this, I need a few things: 
 - A variant selector. Clicking on the emblem should open the variant selector.
 - A new layout (with the stock + drawn pile), shifting the emblem over a bit.
 - Skinable card back, because we now need the other side of the cards too.
 - State and wincount per variant. So you can have multiple games active at the same time, in different variants.

## Selector

First, make a plan and a design for this. We need to iterate on the design first to find how I want the selector to look.

Make a semi interactive design, where the cards are just static in the game. The layout is actually working (at least on desktop). The emblem is clickable, opens the variant selector and you can click on any of the, currently 2, variants. 

Each variant selector is one big button with the emblem and to the right the win counter. On desktop, use a layout with two columns. On mobile, use a single column.

The variant selector itself is fullscreen black background that fades in with a clip-path animation from a circle growing to fill the entire screen.
