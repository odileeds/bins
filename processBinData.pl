#!/usr/bin/perl

use Encode qw/encode decode/;
use Math::BigInt ();


#http://opendata.leeds.gov.uk/downloads/bins/dm_premises.csv
#http://opendata.leeds.gov.uk/downloads/bins/dm_jobs.csv

$dir = "data/leeds/";
if($ARGV[0] && -d $ARGV[0]){ $dir = $ARGV[0]; }

%conv = ('GREEN'=>'G','BLACK'=>'B','BROWN'=>'R','FOOD'=>'F');

#PremisesID,Type,CollectionDate
#1050327,BROWN,31/08/19
%jobs;
%collections;
print "Processing jobs...\n";
open(FILE,$dir."dm_jobs.csv");
$line = <FILE>;
while($line = <FILE>){
	$line = decode("UCS-2BE", $line);
	$line =~ s/[\n\r]//g;
	($p,$t,$d) = split(/,/,$line);
	if($p){
		$p = sprintf("%07d",$p);
		if(!$jobs{$p}){ @{$jobs{$p}} = (); }
		$d =~ s/([0-9]{2})\/([0-9]{2})\/([0-9]{2})/$3$2$1/;
		if($conv{$t}){ $t = $conv{$t}; }
		else { print "No short version of ".$t."\n"; }
		push(@{$jobs{$p}},"$d:$t");
	}
}
close(FILE);

$nperfile = 1000;
%convdate;
@premises = sort(keys(%jobs));
for($i = 0; $i < @premises ; $i++){
	$p = $premises[$i];
	$p =~ s/^0+//g;
	$str = "";
	@js = sort(@{$jobs{$premises[$i]}});
	$max = @js;
	if($max > 9){ $max = 9; }
	for($j = 0; $j < $max; $j++){
		($d,$t) = split(':',$js[$j]);
		# Convert the date to base 36
		if(!$convdate{$d}){ $convdate{$d} = encode_base36($d); }
		$str .= "$convdate{$d}$t";
	}
	$collections{$p} = $str;
}


# Read in the OS streets data
print "Read OS streets data...\n";
open(FILE,$dir."names.csv");
@lines = <FILE>;
close(FILE);
%roads;
%names;
$n = @lines;
for($i = 0; $i < $n; $i++){
	$lines[$i] =~ s/[\n\r]//g;
	#Abaseen Close,Bradford,BD3,r,53.7935,-1.7306
	(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$lines[$i]);
	$roads{lc($cols[0].", ".$cols[1])} = "$cols[0],$cols[1],$cols[2],$cols[4],$cols[5]";
	$names{lc($cols[0])} = $cols[0];
}

# Read in the OS places data
print "Read OS places data...\n";
open(FILE,$dir."places.csv");
@lines = <FILE>;
close(FILE);
%places;
$n = @lines;
for($i = 0; $i < $n; $i++){
	$lines[$i] =~ s/[\n\r]//g;
	#Aberford,Leeds,LS25,53.8298,-1.3430
	(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$lines[$i]);
	$places{lc($cols[0].", ".$cols[1])} = "$cols[0]\t$cols[1]\t$cols[2]\t$cols[3]\t$cols[4]";
	$places{lc($cols[0])} = "$cols[0]\t$cols[1]\t$cols[2]\t$cols[3]\t$cols[4]";
}


# Now process bin premises data
open(FILE,$dir."dm_premises.csv");
@lines = <FILE>;
close(FILE);

$n = @lines;
%streets;

print "Processing premises file...\n";
%premiseslookup;
for($i = 1; $i < $n; $i++){

	# For some reason the premises file is encoded
	# in an unusual format so we get it into UTF8
	$lines[$i] = decode("UCS-2BE", $lines[$i]);
	 
	$lines[$i] =~ s/[\n\r]//g;
	(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$lines[$i]);

	$s = $cols[3]."\t".$cols[4]."\t".$cols[5];
	# Force uppercase to make things consistent
	$s = uc($s);

	# The file is saved in UCS-2 LE BOM which seems to add 
	# invisible characters so we want to tidy up the number
	$cols[2] =~ s/[^0-9]//g;

	$p = encode_base36($cols[0]);
	$premiseslookup{$p} = $cols[0];
	$id = "$cols[1]".($cols[1] ? ($cols[2] ? ", ":""):"").sprintf("%05d",$cols[2]).":".$p;
	if($cols[3]){
		if(!$streets{$s}){
			@{$streets{$s}} = ($id);
		}else{
			push(@{$streets{$s}},$id)
		}
	}
}

$start = "AAA";
$counter = 0;
$i = 0;
$f = 0;
@lines = ();
$limit = 50;
%index;
@jlines = ();
foreach $s (sort(keys(%streets))){
	$tempname = $s;
	$tempname =~ s/[^A-Za-z]//g;
	if($tempname =~ /^([A-Za-z]{3})/){

		$first = $1;

		(@cols) = split(/\t/,$s);

		$addr = "";
		$key = lc($cols[0].", ".$cols[1]);
		print "$s\n";
#		print "\tA: ".$key." - ".$roads{$key}."\n";
		if(!$roads{$key}){
			$key = lc($cols[0].", ".$cols[2]);
#			print "\tB: ".$key." - ".$roads{$key}."\n";
			if(!$roads{$key}){
				$key = lc("$cols[2]");
#				print "\tC: ".$key."\n";
				if($places{$key}){
					@bits = split(/\t/,$places{$key});
					$key = lc($cols[0].", ".$bits[1]);
#					print "\t\t$key - $roads{$key}\n";
					$addr = $roads{$key};
					if($roads{$key}){
						$addr = $roads{$key};
					}else{
						$p = lc("$cols[1], $cols[2]");
#						print "\tC2 - $p - $places{$p}\n";
						if($places{$p}){
							@bits = split(/\t/,$places{$p});
							$addr = "$cols[0],$bits[0],$bits[2],$bits[3],$bits[4]";
						}else{
							$p = lc("$cols[1]");
							if($places{$p}){
								@bits = split(/\t/,$places{$p});
								$addr = "$cols[0],$cols[1],$bits[2],$bits[3],$bits[4]";
							}else{
								$addr = "$cols[0],$cols[1],,,";
							}
						}
					}
				}
			}else{
				# If the final name doesn't contain the original area (e.g. Scholes) we put it back but get the case right
#				print "\tB2: ".lc("$cols[1], $cols[2]")." = ".$places{lc("$cols[1], $cols[2]")}."\n";
				$addr = $roads{$key};
				if($cols[1]){
					if($places{lc("$cols[1], $cols[2]")}){
						@bits = split(/\t/,$places{lc("$cols[1], $cols[2]")});
						$addr =~ s/^([^\,]*),([^\,]*),/$1,$bits[0],/;
					}else{
#						print "$cols[$1] - ".$places{lc("$cols[1]")}."\n";
						if($places{lc("$cols[1]")}){
							@bits = split(/\t/,$places{lc("$cols[1]")});
							$addr =~ s/^([^\,]*),([^\,]*),/$1,$bits[0],/;
						}
					}
				}
			}
		}else{
			$addr = $roads{$key};
		}
		
		
		
#		print "\t\tADDR:$addr\n";
#		print "\t\tPLACE:$cols[1]\n";
		if($addr !~ /^[^\,]*,$cols[1]/i){
#			print "\t\tNO MATCH\n";
			$p = lc("$cols[1], $cols[2]");
#			print "\t\tCHECK - $p - $places{$p}\n";
			if($places{$p}){
				@bits = split(/\t/,$places{$p});
				$addr =~ s/^([^\,]*),([^\,]*),/$1,$bits[0],/;
			}else{
				$p = lc("$cols[1]");
#				print "\t\tCHECK2 - $p - $places{$p} =$addr=\n";
				if($places{$p}){
					@bits = split(/\t/,$places{$p});
					if($addr){
						$addr =~ s/^([^\,]*),([^\,]*),/$1,$bits[0],/;
					}else{
						$addr = "$cols[0],$bits[0],$bits[2],$bits[3],$bits[4]";
					}
				}
			}
		}
		
		# Can we replace an all-caps version with something nicer?
		if($addr =~ /^([^a-z]*),/){
			$st = lc($1);
#			print "\tD:$st\n";
			if($names{$st}){
				$addr =~ s/^([^\,]*),/$names{$st},/;
			}
		}
		
		$addr =~ s/\,/\t/g;
		
		print "\t$addr\n";

		if($counter > $limit && $first ne $last){
			# Reset and open new file
			if($f > 0){
				$temp = nextLetters($start);
			}else{
				$temp = $start;
			}
			
			$index{"$temp-$last"} = $dir."premises-$temp-$last.csv";
			open(FILE,">",$index{"$temp-$last"});
			print FILE @lines;
			close(FILE);
			open(FILE,">",$dir."jobs-$temp-$last.csv");
			print FILE @jlines;
			close(FILE);
			@lines = ();
			@jlines = ();
			$counter = 0;
			$start = $last;
			$f++;
		}
		if($addr){
			$line = "$addr\t";
			foreach $id (sort(@{$streets{$s}})){
				$id =~ s/^0+//g;
				$id =~ s/,\s+0*/, /g;
				$id =~ s/0{5}(:|$)/\1/g;
				$line .= "$id;";
			}
			$line .= "\n";
			push(@lines,$line);

			if($line =~ /\t([^\t]+)\n/){
				@props = split(';',$1);
				for($pr = 0; $pr < @props; $pr++){
					$props[$pr] =~ s/.*://;
					$props[$pr] = $premiseslookup{$props[$pr]};
					if($collections{$props[$pr]}){
						push(@jlines,$props[$pr].",$collections{$props[$pr]}\n");
					}
				}
			}
		}else{
			print "ERROR on $s\n";
		}

		$counter++;
		$last = $first;
	}else{
		print "ERROR on $s\n";
	}
	$i++;
}
if($f > 0){
	$temp = nextLetters($start);
}else{
	$temp = $start;
}
$last = "ZZZ";

$index{"$temp-$last"} = $dir."premises-$temp-$last.csv";
open(FILE,">",$index{"$temp-$last"});
print FILE @lines;
close(FILE);

open(FILE,">",$dir."index.csv");
foreach $key (sort(keys(%index))){
	print FILE "$key,$index{$key}\n";
}
close(FILE);





###################

sub previousLetters {
	my $code = $_[0];
	my $len = length($code);
	my @cs = split(//,$code);
	my $i;
	my $n = @cs;
	for($i = $n - 1; $i >= 0; $i--){
		$c = chr(ord($cs[$i])-1);
		if($c eq "@"){
			$cs[$i] = "Z";
		}else{
			$cs[$i] = $c;
			$i = -1;
		}
	}
	if(join('',@cs) =~ /^Z+$/i){ return $code; }
	return join('',@cs);
}

sub nextLetters {
	my $code = $_[0];
	my $len = length($code);
	my @cs = split(//,$code);
	my $i;
	my $n = @cs;
	for($i = $n - 1; $i >= 0; $i--){
		$c = chr(ord($cs[$i])+1);
		if($c eq "["){
			$cs[$i] = "A";
		}else{
			$cs[$i] = $c;
			$i = -1;
		}
	}
	if(join('',@cs) =~ /^A+$/i){ return $code; }
	return join('',@cs);
}

sub decode_base36 {
    my $base36 = uc( shift );
    die 'Invalid base36 number' if $base36 =~ m{[^0-9A-Z]};
 
    my ( $result, $digit ) = ( 0, 0 );
    for my $char ( split( //, reverse $base36 ) ) {
        my $value = $char =~ m{\d} ? $char : ord( $char ) - 55;
        $result += $value * Math::BigInt->new( 36 )->bpow( $digit++ );
    }
 
    return $result;
}
sub encode_base36 {
	my ( $number, $padlength ) = @_;
	$padlength ||= 1;

	die 'Invalid base10 number'  if $number	=~ m{\D};
	die 'Invalid padding length' if $padlength =~ m{\D};

	my $result = '';
	while ( $number ) {
		my $remainder = $number % 36;
		$result .= $remainder <= 9 ? $remainder : chr( 55 + $remainder );
		$number = int $number / 36;
	}

	return '0' x ( $padlength - length $result ) . reverse( $result );
}