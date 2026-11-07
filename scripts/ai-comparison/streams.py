"""Reproduce the archive's Python Random/BLAKE2b dice streams; no dependencies."""
import hashlib, random, struct, sys
stream = sys.argv[5] if len(sys.argv)>5 else 'dice'
count = 560 if stream=='lookahead' else 35
start, games, turns = map(int, sys.argv[1:4])
with open(sys.argv[4], 'wb') as out:
    for gid in range(start, start + games):
        for seat in range(2):
            for own in range(turns):
                seed = int.from_bytes(hashlib.blake2b(
                    f'cantstop-v2:{gid}:{seat}:{own}:{stream}'.encode(), digest_size=16).digest(), 'big')
                rng = random.Random(seed)
                out.write(struct.pack(f'<{count}H', *(rng.randrange(1296) for _ in range(count))))
