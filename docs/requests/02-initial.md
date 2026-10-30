This project should become a nice, browser based, solitair game that I can play either on my desktop/laptop as well as on my phone. 

The phone part is probably the hardest. As the cards need to be significantly smaller while still remaning readable. Most solitaire games are also quite hoirizontal and not very vertical, making the phone screen very poorly suited for this. I don't want to play it in landscape mode because it just feels horrible. 

## Ruleset

The ruleset from bobbies beautiful bugs. I'm not sure if this is an actual ruleset with a different name. But the concept is simple.
Deck: Full set of cards, A to K + an additional "emporer" card per suite.
Setup: All cards delt immediatly, face up from left to right in 11 piles on the tableau with 4 empty "foundation" piles. The cards don't divide evenly, so the first few columns have more cards. Reserve place for a stock, although it is empty in this ruleset (and does not participate). 
Goal: Place the four suites from A to E (emprorer) in order on the foundation piles. The range must start at A fully, so 8 -> E is not a valid win condition. The tableau needs to be empty.
Rules:
 - Any top card of a column can be moved by itself onto a pile containing the next card in the sequence for the same suite. So a 7 can be placed on an 8. A J can be placed on a Q, etc.
 - Any valid stack at the top of a column can be moved as a whole. So 9/8/7/6 can be moved entirely onto the 10, for the same suite.
 - Any card can be placed in an empty foundation pile
 - Any single card can be placed on another in the foundation pile, given it is the next in sequence and of the same suite. So if the foundation contains an 8, placing a 9 is allowed.
 - The top card from any foundation pile can be removed, and readded to the tableau. Ofcourse, with the same rules as normal placement
 - Any card or stack can be placed on an empty column in the tableau
 - Cards from foundations are allowed to move to other foundations without going through the tableau.

The game is not garanteed to be solvable, although with this ruleset unlikely.

## Features

 - There should be a button to make a new deal. This can be used when you're either stuck or just want to start over.
 - The game should have drag and drop to begin with.
 - State should be saved between sessions. Either periodic saving or after every actual change.
 - Add a win counter.

## Scope and constraints

 - Local only. The whole thing should run in your browser. Static site hosting should be enough to host the game.
 - Well performing. I played some other browser based solitaire games and they really lagged out my laptop. I don't want that to happen. 
 - Satisfying. More of a design thing, the game should be animated so it feels good to play. This is _very_ vague and can be mostly ignored, but it is just something to keep in mind when developing and will probably be mentioned in the feedback.
 - Decks with additional cards. For now, just the one in the ruleset, but in future we will have more decks with different tyeps of cards.
 - Only use artwork that is freely available with an open license. If no artwork can be found (emporer for example), just use placeholder text instead.
 - Time and move count are out of scope.

## Future scope

For now, these are out of scope, but the future would need those
 - Sounds. The game should have sounds. I will deliver the sounds at some point. I have them already recorded a while ago, so I just need to find them and submit them here.
 - Different deck art. Just different decks, either to unlock or just to select for fun. For now, single deck with regular art.
 - Multiple variants/rulesets. 
 - Automatic stacking when the game is (nearly) finished to put things to foundation whenever possible. Not in scope for now.
 - Undo's
 - Controller input
 - PWA installs is a nice to have. Either done now or later depending on if that has any effect on how fast development goes.

## Open questions for the plan

For this initial request, we need a few questions answered and probably a plan for that:
 - What will the tech stack be. I'm fine with something like vite (vanilla JS) or angular. As long as it supports what we need to do. Something completely different is fine too.
 - Where do we source the initial art. I want to create the art for the cards myself later, so preferably something temporary and swapable later. 
 - How will we do the layout on mobile, to keep it usable.

## Goal

Create a plan for this, include 3 mockups with different designs for how the game should look and what the layout of the page should be. For each of the mocksups, make both a normal one and a mobile one. Static HTML for mockups is acceptible.