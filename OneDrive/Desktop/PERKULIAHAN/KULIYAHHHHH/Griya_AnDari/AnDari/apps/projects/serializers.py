from rest_framework import serializers
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    region_nama = serializers.CharField(source='region.nama', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'nama_proyek', 'pemilik', 'region', 'region_nama',
            'panjang_lahan', 'lebar_lahan', 'jumlah_lantai',
            'gaya_arsitektur', 'target_budget',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RabEstimateRequestSerializer(serializers.Serializer):
    region_name = serializers.CharField(max_length=100)
    plan = serializers.JSONField()

    def validate_plan(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Data denah harus berupa objek.')
        if not isinstance(value.get('rooms', []), list):
            raise serializers.ValidationError('Daftar ruangan tidak valid.')
        if not isinstance(value.get('walls', []), list):
            raise serializers.ValidationError('Daftar dinding tidak valid.')
        if not value.get('rooms') and not value.get('walls'):
            raise serializers.ValidationError(
                'Tambahkan ruangan atau dinding sebelum menghitung RAB.'
            )
        return value