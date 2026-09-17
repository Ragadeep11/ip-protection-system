"""
Unit and Integration Tests for ML Similarity & Transformation Forensics
"""

import sys
import os
import unittest
import numpy as np
from PIL import Image

# Ensure local module is importable
sys.path.insert(0, os.path.dirname(__file__))

from similarity import (
    preprocess_text,
    calculate_text_similarity,
    compute_image_fingerprints,
    compare_image_fingerprints,
    corpus_manager
)
from transformation import (
    detect_image_transformations,
    detect_text_transformations
)


class TestMLService(unittest.TestCase):

    def setUp(self):
        import copy
        self._saved_corpus = copy.deepcopy(corpus_manager.corpus)

    def tearDown(self):
        corpus_manager.corpus = self._saved_corpus
        corpus_manager.save()

    def test_text_exact_similarity(self):
        text_a = "Decentralized autonomous intellectual property protocol on Ethereum."
        text_b = "Decentralized autonomous intellectual property protocol on Ethereum."
        res = calculate_text_similarity(text_a, text_b)
        self.assertGreaterEqual(res["score"], 0.95)

    def test_text_unrelated_similarity(self):
        text_a = "Decentralized autonomous intellectual property protocol on Ethereum."
        text_b = "A recipe for chocolate chip cookies with organic butter and sugar."
        res = calculate_text_similarity(text_a, text_b)
        self.assertLess(res["score"], 0.20)

    def test_text_paraphrase_transformation(self):
        ref = "The company developed a new cryptographic hashing algorithm for blockchain security."
        plagiarized = "For blockchain security the company developed a new algorithm with cryptographic hashing."
        res = detect_text_transformations(plagiarized, ref)
        self.assertTrue(res["is_transformed"])
        self.assertGreaterEqual(res["vocabulary_cosine"], 0.70)

    def test_image_identical_fingerprints(self):
        # Create a test synthetic image (64x64 with geometric shape)
        img = Image.new("RGB", (64, 64), color=(255, 255, 255))
        for x in range(20, 44):
            for y in range(20, 44):
                img.putpixel((x, y), (100, 50, 200))

        fps = compute_image_fingerprints(img)
        cmp_res = compare_image_fingerprints(fps, fps)
        self.assertAlmostEqual(cmp_res["composite_similarity"], 1.0, places=2)

    def test_image_rotation_transformation(self):
        # Create an asymmetrical image
        img = Image.new("RGB", (80, 80), color=(240, 240, 240))
        for x in range(10, 30):
            for y in range(10, 60):
                img.putpixel((x, y), (20, 20, 200))

        ref_fps = compute_image_fingerprints(img)

        # Rotate by 90 degrees
        rotated = img.rotate(90, expand=True)

        detect_res = detect_image_transformations(rotated, ref_fps)
        # Should detect ROTATION_90_DEG or ROTATION_270_DEG candidate match
        transforms = [t["transformation_type"] for t in detect_res["all_detected_transformations"]]
        self.assertTrue(any("ROTATION" in t for t in transforms))

    def test_corpus_search(self):
        query = "This specification describes a decentralized autonomous protocol for managing intellectual property on Ethereum."
        res = corpus_manager.check_text_plagiarism(query)
        self.assertGreaterEqual(res["highest_similarity"], 0.70)
        self.assertEqual(res["risk_level"], "HIGH")
        self.assertIn("PLAGIARISM", res["status"])

    def test_duplicate_image_rejection(self):
        # Create a unique test image
        img = Image.new("RGB", (64, 64), color=(120, 80, 210))
        test_cid = "QmTestUniqueImageCID12345"
        # First registration should succeed
        corpus_manager.add_image_asset(asset_id=9991, title="Original IP", img=img, cid=test_cid)
        
        # Second registration with SAME image, different title and ID must be rejected!
        with self.assertRaises(ValueError) as ctx:
            corpus_manager.add_image_asset(asset_id=9992, title="Copied IP with New ID", img=img, cid="QmDifferentCID54321")
        self.assertIn("Duplicate asset rejected", str(ctx.exception))

    def test_duplicate_cid_rejection(self):
        # Re-registering with an already existing CID must be rejected
        existing_cid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
        with self.assertRaises(ValueError) as ctx:
            corpus_manager.add_text_asset(
                asset_id=8888,
                title="Plagiarized Copy",
                text="Some unique text here",
                cid=existing_cid
            )
        self.assertIn("Duplicate asset rejected", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
