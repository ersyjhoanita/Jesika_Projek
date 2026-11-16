import re

from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from apps.designs.models import Building
from apps.locations.models import Region
from .models import Project
from .serializers import ProjectSerializer, RabEstimateRequestSerializer
from .services import RabCalculator


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


def normalize_region_name(value):
    normalized = re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()
    return re.sub(r'^kab(?:upaten)?\b', 'kabupaten', normalized)


@api_view(['GET'])
def hitung_rab_building(request, building_id):
    """Endpoint untuk menghitung RAB berdasarkan ID Building"""
    try:
        building = Building.objects.get(id=building_id)
    except Building.DoesNotExist:
        return Response({'error': 'Building tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)
    
    result = RabCalculator.hitung_rab_bangunan(building)
    if 'error' in result:
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)


@api_view(['GET'])
def hitung_rab_project(request, project_id):
    """Endpoint untuk menghitung total RAB seluruh building dalam satu project"""
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)
    
    total_rab = 0
    all_details = []
    for building in project.buildings.all():
        result = RabCalculator.hitung_rab_bangunan(building)
        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        total_rab += result['total_rab']
        all_details.append({
            'building_id': building.id,
            'building_name': building.nama,
            'result': result
        })
    
    return Response({
        'project_id': project.id,
        'project_name': project.nama_proyek,
        'total_rab_keseluruhan': total_rab,
        'details': all_details
    })

@api_view(['POST'])
def hitung_rab_denah(request):
    serializer = RabEstimateRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    requested_region = normalize_region_name(serializer.validated_data['region_name'])
    region = next(
        (
            candidate
            for candidate in Region.objects.filter(is_active=True)
            if normalize_region_name(candidate.nama) == requested_region
        ),
        None,
    )
    if region is None:
        return Response(
            {
                'error': (
                    'Daerah proyek tidak ditemukan di katalog backend. '
                    'Periksa nama daerah atau tambahkan daerah di panel admin.'
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        result = RabCalculator.hitung_rab_denah(
            serializer.validated_data['plan'], region
        )
    except ValueError as error:
        return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)