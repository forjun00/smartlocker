#pragma once
#include <Arduino.h>

struct Slot {
  int id;
  int relayPin;
  int doorPin;     // -1 = no sensor
};

constexpr int MAX_SLOTS = 16;

extern const uint16_t PULSE_MS;
extern const bool     RELAY_ACTIVE_HIGH;

extern int  slotCount;
extern Slot slots[MAX_SLOTS];
extern bool relayOn[MAX_SLOTS];
extern bool lockedState[MAX_SLOTS];
extern bool doorClosed[MAX_SLOTS];

// Defaults applied the first time the device boots (or after a clear).
extern const int DEFAULT_SLOT_COUNT;
extern const int DEFAULT_RELAY_PINS[MAX_SLOTS];

// NVS persistence for the GPIO mapping.
void loadSlotMapping();
void saveSlotMapping();

void initSlots();
Slot* findSlotById(int id);
void  driveRelay(int idx, bool on);
void  pollDoors();

// MQTT-driven (publishes state back over MQTT)
void doLock(int idx);
void doUnlock(int idx);

// Pure local digitalWrite pulse — no MQTT, used by ESP web UI buttons
void manualPulse(int idx);

inline int slotCountValue() { return slotCount; }   // for non-slots code
