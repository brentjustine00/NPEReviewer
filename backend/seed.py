import os

from app import create_app


if __name__ == "__main__":
    # Keep seeding fast by default.
    os.environ.setdefault("NPE_SEED_FAST", "1")
    os.environ.setdefault("NPE_FORCE_RESEED", "0")
    os.environ.setdefault("NPE_EXTERNAL_QUESTION_SOURCE", "1")
    os.environ.setdefault("NPE_PALMER_PER_TOPIC", "16")
    create_app()
    print("Seeding complete (fast mode).")
