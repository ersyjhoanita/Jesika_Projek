from decimal import Decimal, InvalidOperation
from math import hypot

from apps.labor.models import Labor, LaborPrice
from apps.materials.models import Material


class RabCalculator:
    WALL_THICKNESS = Decimal("0.14")
    BRICK_PER_M3 = Decimal("500")
    CEMENT_BAGS_PER_M3 = Decimal("0.2")
    SAND_M3_PER_M3 = Decimal("0.05")
    MASON_OH_PER_M3 = Decimal("0.5")
    WORKER_OH_PER_M3 = Decimal("1")

    @staticmethod
    def hitung_volume_wall(wall):
        length = hypot(wall.end_x - wall.start_x, wall.end_y - wall.start_y)
        return length * float(wall.tinggi) * float(wall.tebal)

    @staticmethod
    def hitung_volume_bangunan(building):
        total_volume = 0
        for floor in building.floors.all():
            for wall in floor.walls.all():
                total_volume += RabCalculator.hitung_volume_wall(wall)
        return total_volume

    @staticmethod
    def _decimal(value, label, default=None):
        if value is None and default is not None:
            return default
        try:
            result = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f"Nilai {label} tidak valid.")
        if not result.is_finite():
            raise ValueError(f"Nilai {label} tidak valid.")
        return result

    @staticmethod
    def _line_item(code, name, quantity, unit, material=None, note=None):
        if material is None:
            return {
                "code": code,
                "name": name,
                "quantity": float(quantity),
                "unit": unit,
                "unit_price": None,
                "total": None,
                "status": "missing_price",
                "note": note or f"Harga {name} belum tersedia di katalog daerah.",
            }

        total = (quantity * material.harga_satuan).quantize(Decimal("0.01"))
        return {
            "code": code,
            "name": name,
            "quantity": float(quantity),
            "unit": unit,
            "unit_price": float(material.harga_satuan),
            "total": float(total),
            "status": "priced",
            "source": material.source,
            "note": note,
        }

    @staticmethod
    def _find_material(region, names):
        for name in names:
            material = (
                Material.objects.filter(region=region, nama_material__iexact=name)
                .order_by("-last_updated", "-id")
                .first()
            )
            if material:
                return material, name
        return None, None

    @staticmethod
    def _find_labor_price(region, role_name):
        labor = Labor.objects.filter(nama_peran__iexact=role_name).first()
        if not labor:
            return None
        return (
            LaborPrice.objects.filter(labor=labor, region=region)
            .order_by("-updated_at", "-id")
            .first()
        )

    @staticmethod
    def _wall_segments(plan):
        segments = []
        room_areas = []

        for room in plan.get("rooms", []):
            if not isinstance(room, dict):
                continue
            x = RabCalculator._decimal(room.get("x"), "posisi ruangan X", Decimal(0))
            y = RabCalculator._decimal(
                room.get("y", room.get("z")), "posisi ruangan Y", Decimal(0)
            )
            length = RabCalculator._decimal(
                room.get("panjang", room.get("length")), "panjang ruangan"
            )
            width = RabCalculator._decimal(
                room.get("lebar", room.get("width")), "lebar ruangan"
            )
            if length <= 0 or width <= 0:
                raise ValueError("Ukuran setiap ruangan harus lebih dari nol.")
            right = x + length
            bottom = y + width
            segments.extend(
                [
                    (x, y, right, y),
                    (right, y, right, bottom),
                    (right, bottom, x, bottom),
                    (x, bottom, x, y),
                ]
            )
            room_areas.append(length * width)

        for wall in plan.get("walls", []):
            if not isinstance(wall, dict):
                continue
            x1 = RabCalculator._decimal(wall.get("x1"), "koordinat dinding X1")
            y1 = RabCalculator._decimal(
                wall.get("y1", wall.get("z1")), "koordinat dinding Y1"
            )
            x2 = RabCalculator._decimal(wall.get("x2"), "koordinat dinding X2")
            y2 = RabCalculator._decimal(
                wall.get("y2", wall.get("z2")), "koordinat dinding Y2"
            )
            if x1 != x2 or y1 != y2:
                segments.append((x1, y1, x2, y2))

        groups = {}
        for x1, y1, x2, y2 in segments:
            dx = float(x2 - x1)
            dy = float(y2 - y1)
            length = hypot(dx, dy)
            if length == 0:
                continue
            ux = dx / length
            uy = dy / length
            if ux < 0 or (abs(ux) < 1e-8 and uy < 0):
                ux = -ux
                uy = -uy
            nx, ny = -uy, ux
            offset = nx * float(x1) + ny * float(y1)
            key = (round(ux, 4), round(uy, 4), round(offset, 3))
            start = float(x1) * ux + float(y1) * uy
            end = float(x2) * ux + float(y2) * uy
            groups.setdefault(key, []).append((min(start, end), max(start, end)))

        total_length = 0.0
        for intervals in groups.values():
            intervals.sort()
            start, end = intervals[0]
            for next_start, next_end in intervals[1:]:
                if next_start <= end + 0.01:
                    end = max(end, next_end)
                else:
                    total_length += end - start
                    start, end = next_start, next_end
            total_length += end - start

        roof_area = sum(room_areas, Decimal(0))
        if roof_area == 0 and segments:
            xs = [float(point) for segment in segments for point in (segment[0], segment[2])]
            ys = [float(point) for segment in segments for point in (segment[1], segment[3])]
            roof_area = Decimal(str(max(xs) - min(xs))) * Decimal(
                str(max(ys) - min(ys))
            )

        return Decimal(str(total_length)), roof_area

    @staticmethod
    def _openings(plan):
        doors = {}
        windows = {}
        opening_area = Decimal(0)

        def add(kind, opening):
            nonlocal opening_area
            if not isinstance(opening, dict):
                return
            width = RabCalculator._decimal(
                opening.get("width"), "lebar bukaan",
                Decimal("0.8") if kind == "door" else Decimal("1.2"),
            )
            height = RabCalculator._decimal(
                opening.get("height"), "tinggi bukaan",
                Decimal("2.1") if kind == "door" else Decimal("1.2"),
            )
            if width <= 0 or height <= 0:
                raise ValueError("Ukuran pintu dan jendela harus lebih dari nol.")
            opening_area += width * height
            raw_type = str(opening.get("type") or "").strip().lower()
            types = doors if kind == "door" else windows
            normalized_type = raw_type or ("single" if kind == "door" else "casement")
            types[normalized_type] = types.get(normalized_type, [0, Decimal(0)])
            types[normalized_type][0] += 1
            types[normalized_type][1] += width * height

        for room in plan.get("rooms", []):
            if not isinstance(room, dict):
                continue
            for opening in room.get("doors", []):
                add("door", opening)
            for opening in room.get("windows", []):
                add("window", opening)

        for wall in plan.get("walls", []):
            if not isinstance(wall, dict):
                continue
            if isinstance(wall.get("openings"), list):
                for opening in wall["openings"]:
                    if isinstance(opening, dict):
                        add(opening.get("kind"), opening)
            else:
                for opening in wall.get("doors", []):
                    add("door", opening)
                for opening in wall.get("windows", []):
                    add("window", opening)

        return doors, windows, opening_area

    @classmethod
    def hitung_rab_denah(cls, plan, region):
        if not isinstance(plan, dict):
            raise ValueError("Data denah tidak valid.")
        if not isinstance(plan.get("rooms", []), list) or not isinstance(
            plan.get("walls", []), list
        ):
            raise ValueError("Data ruangan atau dinding tidak valid.")

        wall_length, roof_area = cls._wall_segments(plan)
        if wall_length <= 0:
            raise ValueError("Tambahkan ruangan atau dinding sebelum menghitung RAB.")

        wall_height = cls._decimal(plan.get("wallHeight"), "tinggi dinding", Decimal(3))
        if wall_height <= 0:
            raise ValueError("Tinggi dinding harus lebih dari nol.")

        doors, windows, opening_area = cls._openings(plan)
        wall_surface = max(
            Decimal(0), wall_length * wall_height - opening_area
        )
        wall_volume = wall_surface * cls.WALL_THICKNESS
        items = []

        wall_materials = [
            ("bricks", "Batu Bata", wall_volume * cls.BRICK_PER_M3, "bh", ("bh", "buah", "unit")),
            ("cement", "Semen", wall_volume * cls.CEMENT_BAGS_PER_M3, "zak", ("zak", "sak")),
            ("sand", "Pasir", wall_volume * cls.SAND_M3_PER_M3, "m3", ("m3", "m³")),
        ]
        for code, name, quantity, unit, accepted_units in wall_materials:
            material, _ = cls._find_material(region, (name,))
            if material and material.satuan.strip().lower() not in accepted_units:
                material = None
            items.append(
                cls._line_item(
                    code,
                    name,
                    quantity,
                    unit,
                    material,
                    f"Koefisien estimasi {quantity / wall_volume if wall_volume else 0} {unit}/m³ dinding.",
                )
            )

        labor_specs = [
            ("mason_labor", "Upah Tukang Batu", cls.MASON_OH_PER_M3, "Tukang Batu"),
            ("worker_labor", "Upah Pekerja", cls.WORKER_OH_PER_M3, "Pekerja"),
        ]
        for code, label, coefficient, role_name in labor_specs:
            labor_price = cls._find_labor_price(region, role_name)
            quantity = wall_volume * coefficient
            if labor_price and labor_price.labor.satuan.strip().lower() not in (
                "oh",
                "hari",
            ):
                labor_price = None
            if labor_price:
                total = (quantity * labor_price.upah_per_satuan).quantize(
                    Decimal("0.01")
                )
                items.append(
                    {
                        "code": code,
                        "name": label,
                        "quantity": float(quantity),
                        "unit": "OH",
                        "unit_price": float(labor_price.upah_per_satuan),
                        "total": float(total),
                        "status": "priced",
                        "source": labor_price.source,
                    }
                )
            else:
                items.append(
                    {
                        "code": code,
                        "name": label,
                        "quantity": float(quantity),
                        "unit": "OH",
                        "unit_price": None,
                        "total": None,
                        "status": "missing_price",
                        "note": f"Upah {role_name} belum tersedia di katalog daerah.",
                    }
                )

        door_labels = {
            "single": ("Pintu Single", "Pintu Tunggal", "Pintu"),
            "swing": ("Pintu Single", "Pintu Tunggal", "Pintu"),
            "double": ("Pintu Double", "Pintu Ganda", "Pintu"),
            "double_swing": ("Pintu Double", "Pintu Ganda", "Pintu"),
            "sliding": ("Pintu Sliding", "Pintu Geser", "Pintu"),
            "folding": ("Pintu Folding", "Pintu Lipat", "Pintu"),
        }
        window_labels = {
            "casement": ("Jendela Casement", "Jendela Buka", "Jendela"),
            "sliding": ("Jendela Sliding", "Jendela Geser", "Jendela"),
            "awning": ("Jendela Awning", "Jendela Jungkit", "Jendela"),
            "fixed": ("Jendela Fixed", "Jendela Mati", "Jendela"),
            "jalousie": ("Jendela Jalousie", "Jendela Kisi", "Jendela"),
        }

        def add_opening_items(openings, labels_by_type, prefix, default_label):
            for opening_type, (count, area) in openings.items():
                names = labels_by_type.get(opening_type, (default_label,))
                material, matched_name = cls._find_material(region, names)
                code = f"{prefix}_{opening_type}"
                label = f"{default_label} ({opening_type})"
                if material:
                    unit = material.satuan.strip().lower()
                    if unit in ("unit", "buah", "bh", "set"):
                        quantity, display_unit = Decimal(count), "unit"
                    elif unit in ("m2", "m²"):
                        quantity, display_unit = area, "m²"
                    else:
                        material = None
                        quantity, display_unit = Decimal(count), "unit"
                else:
                    quantity, display_unit = Decimal(count), "unit"
                note = None
                if material and matched_name == default_label:
                    note = "Harga katalog umum digunakan untuk jenis ini."
                items.append(
                    cls._line_item(code, label, quantity, display_unit, material, note)
                )

        add_opening_items(doors, door_labels, "door", "Pintu")
        add_opening_items(windows, window_labels, "window", "Jendela")

        roof_type = str(plan.get("roofType") or "pelana").strip().lower()
        roof_labels = {
            "pelana": ("Atap Pelana", "Atap"),
            "limas": ("Atap Limas", "Atap"),
            "joglo": ("Atap Joglo", "Atap"),
            "datar": ("Atap Datar", "Atap"),
            "mansard": ("Atap Mansard", "Atap"),
        }
        roof_material, matched_roof = cls._find_material(
            region, roof_labels.get(roof_type, ("Atap",))
        )
        if roof_material and roof_material.satuan.strip().lower() not in (
            "m2",
            "m²",
        ):
            roof_material = None
        items.append(
            cls._line_item(
                "roof",
                f"Penutup atap ({roof_type})",
                roof_area,
                "m²",
                roof_material,
                "Kuantitas menggunakan luas proyeksi ruangan; belum memperhitungkan kemiringan atap."
                if roof_material and matched_roof == "Atap"
                else None,
            )
        )

        priced_items = [item for item in items if item["status"] == "priced"]
        missing_items = [item for item in items if item["status"] != "priced"]
        subtotal = sum(
            (Decimal(str(item["total"])) for item in priced_items), Decimal(0)
        ).quantize(Decimal("0.01"))

        return {
            "region": region.nama,
            "items": items,
            "subtotal": float(subtotal),
            "grand_total": float(subtotal) if not missing_items else None,
            "is_complete": not missing_items,
            "missing_items": [item["name"] for item in missing_items],
            "notes": [
                "Estimasi mencakup dinding, pintu, jendela, dan penutup atap yang terdata.",
                "Pondasi, struktur, lantai, listrik, dan plumbing tidak termasuk.",
                "Luas atap memakai proyeksi ruangan dan belum memperhitungkan kemiringan.",
            ],
        }

    @classmethod
    def hitung_rab_bangunan(cls, building):
        volume = cls.hitung_volume_bangunan(building)
        region = building.project.region
        if region is None:
            return {"error": "Proyek belum memiliki daerah untuk harga RAB."}

        try:
            bata = Material.objects.get(
                nama_material__iexact="Batu Bata", region=region
            )
            semen = Material.objects.get(nama_material__iexact="Semen", region=region)
            pasir = Material.objects.get(nama_material__iexact="Pasir", region=region)
        except Material.DoesNotExist:
            return {"error": "Data material tidak lengkap untuk daerah ini."}

        tukang = Labor.objects.filter(nama_peran__iexact="Tukang Batu").first()
        pekerja = Labor.objects.filter(nama_peran__iexact="Pekerja").first()
        if not tukang or not pekerja:
            return {"error": "Data tenaga kerja tidak lengkap untuk daerah ini."}
        tukang_price = cls._find_labor_price(region, tukang.nama_peran)
        pekerja_price = cls._find_labor_price(region, pekerja.nama_peran)
        if not tukang_price or not pekerja_price:
            return {"error": "Data upah tenaga kerja tidak lengkap untuk daerah ini."}

        biaya_bata = volume * 500 * float(bata.harga_satuan)
        biaya_semen = volume * 0.2 * float(semen.harga_satuan)
        biaya_pasir = volume * 0.05 * float(pasir.harga_satuan)
        biaya_tukang = volume * 0.5 * float(tukang_price.upah_per_satuan)
        biaya_pekerja = volume * float(pekerja_price.upah_per_satuan)
        total = biaya_bata + biaya_semen + biaya_pasir + biaya_tukang + biaya_pekerja

        return {
            "total_rab": total,
            "detail": {
                "volume_dinding": volume,
                "biaya_bata": biaya_bata,
                "biaya_semen": biaya_semen,
                "biaya_pasir": biaya_pasir,
                "biaya_tukang": biaya_tukang,
                "biaya_pekerja": biaya_pekerja,
            },
        }
