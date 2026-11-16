from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.labor.models import Labor, LaborPrice
from apps.locations.models import Region
from apps.materials.models import Material


class RabEstimateApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.region = Region.objects.create(
            nama="Kabupaten Sleman",
            kode="SLEMAN",
        )
        self.plan = {
            "wallHeight": 3,
            "roofType": "pelana",
            "rooms": [
                {
                    "x": 0,
                    "y": 0,
                    "panjang": 2,
                    "lebar": 3,
                    "doors": [
                        {
                            "type": "single",
                            "width": 0.9,
                            "height": 2.1,
                        }
                    ],
                    "windows": [
                        {
                            "type": "casement",
                            "width": 1.2,
                            "height": 1.2,
                        }
                    ],
                }
            ],
            "walls": [],
        }

    def add_material(self, name, unit, price):
        return Material.objects.create(
            nama_material=name,
            satuan=unit,
            harga_satuan=Decimal(price),
            region=self.region,
        )

    def add_labor(self, role, rate):
        labor = Labor.objects.create(nama_peran=role, kategori="Sipil")
        return LaborPrice.objects.create(
            labor=labor,
            region=self.region,
            upah_per_satuan=Decimal(rate),
        )

    def test_returns_estimate_for_local_plan_and_regional_prices(self):
        self.add_material("Batu Bata", "bh", "1000")
        self.add_material("Semen", "zak", "100000")
        self.add_material("Pasir", "m3", "200000")
        self.add_material("Pintu Single", "unit", "1500000")
        self.add_material("Jendela Casement", "unit", "850000")
        self.add_material("Atap Pelana", "m2", "250000")
        self.add_labor("Tukang Batu", "150000")
        self.add_labor("Pekerja", "100000")

        response = self.client.post(
            "/api/rab/estimate/",
            {
                "region_name": "Kab. Sleman",
                "plan": self.plan,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_complete"])
        self.assertIsNotNone(response.data["grand_total"])
        item_codes = {item["code"] for item in response.data["items"]}
        self.assertIn("bricks", item_codes)
        self.assertIn("door_single", item_codes)
        self.assertIn("window_casement", item_codes)
        self.assertIn("roof", item_codes)

    def test_missing_regional_prices_are_reported_not_counted_as_zero(self):
        response = self.client.post(
            "/api/rab/estimate/",
            {
                "region_name": "Kab. Sleman",
                "plan": self.plan,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_complete"])
        self.assertIsNone(response.data["grand_total"])
        self.assertGreater(len(response.data["missing_items"]), 0)
