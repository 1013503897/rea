/* Static fixture: compile and inspect, never execute. The only reference into
 * this string lands after its first byte. Point xrefs and object uses differ. */
static const char marker[] = "HEAD:REA atomic interior-only marker";

__attribute__((noinline)) const char *give_suffix(void) {
  return marker + 5;
}

int main(int argc, char **argv) {
  (void)argv;
  return (unsigned char)*give_suffix() == (unsigned char)argc;
}
