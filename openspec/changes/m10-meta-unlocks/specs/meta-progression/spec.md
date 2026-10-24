# Spec Delta

## Purpose

Defines the unlock tree: what Stoken buys between runs, and how it changes a run.

## ADDED Requirements

### Requirement: The boon library limits the pool
A run SHALL only offer boons, and only show boon road signs, of the types in the save's library. A new save SHALL
have POP and GRIND. Curses and duos SHALL only be offered once unlocked.

#### Scenario: A new phone
- **WHEN** a save has no unlocks and the skater reaches a boon pick on floor 8
- **THEN** every card is a POP or GRIND boon, and none is a curse or a duo

### Requirement: Buying an unlock
An unlock SHALL cost its Stoken price once and stay unlocked. It SHALL not be bought without enough Stoken.

#### Scenario: Short of Stoken
- **WHEN** the bank holds 10 Stoken and Webster costs 30
- **THEN** Webster stays locked and the screen says 20 more are needed

### Requirement: Skaters and decks
The ridden skater's passive and the deck's stats SHALL apply on top of the boons. The first floor of a run SHALL
be a boon street of the skater's type when that type is in the library, and POP otherwise.

#### Scenario: Webster
- **WHEN** a run starts as Webster with a new library
- **THEN** grinds are 15% faster and the first floor is a GRIND boon street

### Requirement: Daily run
The daily run SHALL use one seed for each UTC date and keep that day's best score.

#### Scenario: Same day
- **WHEN** two daily runs start on the same UTC date
- **THEN** they skate the same floors
