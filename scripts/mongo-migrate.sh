set -e

export $(grep -v '^#' ../.env | xargs)

mongodump \
  --uri "$MONGO_SRC_URI" \
  --db "$SRC_DB" \
  --archive | \
mongorestore \
  --uri "$MONGO_DEST_URI" \
  --archive \
  --drop \
  --nsFrom "$SRC_DB.*" \
  --nsTo "$DEST_DB.*"
